from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import create_access_token, hash_password, hash_refresh_token, new_refresh_token, verify_password
from app.modules.users.models import RefreshToken, User
from app.modules.users.schemas import AdminCreateUserIn, AdminUpdateUserIn, AdminUserOut, RegisterIn, UserPage


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email.lower()))
    if not user or not verify_password(password, user.password_hash):
        raise ApiError(401, "invalid_credentials")
    if user.disabled_at:
        raise ApiError(403, "account_disabled")
    return user


async def register(db: AsyncSession, body: RegisterIn) -> User:
    email = body.email.lower()
    if await db.scalar(select(User.id).where(User.email == email)):
        raise ApiError(409, "email_taken")
    user = User(email=email, password_hash=hash_password(body.password), full_name=body.full_name.strip(), role=body.role, grade=body.grade,
                province_code=body.province_code)
    db.add(user)
    await db.flush()
    return user


async def issue_session(db: AsyncSession, user: User) -> tuple[str, str]:
    """Tạo access token + refresh token mới. Trả về (access, refresh gốc để đặt cookie)."""
    refresh, digest = new_refresh_token()
    expires = datetime.now(UTC) + timedelta(days=get_settings().refresh_token_days)
    db.add(RefreshToken(user_id=user.id, token_hash=digest, expires_at=expires))
    await db.commit()
    return create_access_token(user.id, user.role), refresh


async def user_from_refresh(db: AsyncSession, refresh: str | None) -> User:
    if not refresh:
        raise ApiError(401, "unauthorized")
    row = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh)))
    if not row or row.revoked_at or row.expires_at <= datetime.now(UTC):
        raise ApiError(401, "unauthorized")
    user = await db.get(User, row.user_id)
    if not user or user.disabled_at:
        raise ApiError(401, "unauthorized")
    return user


async def revoke(db: AsyncSession, refresh: str | None) -> None:
    if refresh:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == hash_refresh_token(refresh), RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
        await db.commit()


# ---------------------------------------------------------------- quản trị người dùng

PAGE_SIZE = 50


async def _revoke_all(db: AsyncSession, user_id: str) -> None:
    """Thu hồi mọi phiên (khóa tài khoản, đổi mật khẩu): các thiết bị phải đăng nhập lại."""
    await db.execute(update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
                     .values(revoked_at=datetime.now(UTC)))


async def _admin_out(db: AsyncSession, users: list[User]) -> list[AdminUserOut]:
    ids = [u.id for u in users]
    last = dict((await db.execute(select(RefreshToken.user_id, func.max(RefreshToken.created_at))
                                  .where(RefreshToken.user_id.in_(ids)).group_by(RefreshToken.user_id))).all()) if ids else {}
    return [AdminUserOut(id=u.id, email=u.email, full_name=u.full_name, role=u.role, grade=u.grade, province_code=u.province_code,
                         created_at=u.created_at, disabled=u.disabled_at is not None, last_login=last.get(u.id)) for u in users]


async def list_users(db: AsyncSession, q: str | None, role: str | None, page: int) -> UserPage:
    stmt = select(User)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.email.ilike(like)))
    if role:
        stmt = stmt.where(User.role == role)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = list(await db.scalars(stmt.order_by(User.created_at.desc()).offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)))
    counts = dict((await db.execute(select(User.role, func.count()).group_by(User.role))).all())
    disabled = await db.scalar(select(func.count()).select_from(User).where(User.disabled_at.is_not(None)))
    return UserPage(items=await _admin_out(db, rows), total=total or 0, page=page, page_size=PAGE_SIZE, counts=counts, disabled=disabled or 0)


async def create_user(db: AsyncSession, body: AdminCreateUserIn) -> AdminUserOut:
    email = body.email.lower()
    if await db.scalar(select(User.id).where(User.email == email)):
        raise ApiError(409, "email_taken")
    user = User(email=email, password_hash=hash_password(body.password), full_name=body.full_name.strip(), role=body.role,
                grade=body.grade if body.role == "student" else None, province_code=body.province_code)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return (await _admin_out(db, [user]))[0]


async def _active_admins(db: AsyncSession) -> int:
    return await db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.disabled_at.is_(None))) or 0


async def update_user(db: AsyncSession, actor: User, user_id: str, body: AdminUpdateUserIn) -> AdminUserOut:
    user = await db.get(User, user_id, with_for_update=True)
    if not user:
        raise ApiError(404, "not_found")
    fields = body.model_fields_set
    role = body.role if "role" in fields and body.role else user.role
    disable = body.disabled if "disabled" in fields and body.disabled is not None else user.disabled_at is not None
    if user.id == actor.id and (role != user.role or disable):
        raise ApiError(409, "cannot_modify_self")  # tự hạ quyền / tự khóa: dễ tự khóa mình ra ngoài
    if user.role == "admin" and not user.disabled_at and (role != "admin" or disable) and await _active_admins(db) <= 1:
        raise ApiError(409, "last_admin")
    grade = body.grade if "grade" in fields else user.grade
    if role == "student" and grade is None:
        raise ApiError(422, "grade_required")
    if "full_name" in fields and body.full_name:
        user.full_name = body.full_name.strip()
    if "province_code" in fields:
        user.province_code = body.province_code
    user.role, user.grade = role, grade if role == "student" else None
    if disable and not user.disabled_at:
        user.disabled_at = datetime.now(UTC)
        await _revoke_all(db, user.id)
    elif not disable:
        user.disabled_at = None
    await db.commit()
    await db.refresh(user)
    return (await _admin_out(db, [user]))[0]


async def set_password(db: AsyncSession, user_id: str, password: str) -> None:
    user = await db.get(User, user_id)
    if not user:
        raise ApiError(404, "not_found")
    user.password_hash = hash_password(password)
    await _revoke_all(db, user.id)
    await db.commit()
