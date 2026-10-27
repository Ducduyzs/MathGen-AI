from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import create_access_token, hash_password, hash_refresh_token, new_refresh_token, verify_password
from app.modules.users.models import RefreshToken, User
from app.modules.users.schemas import RegisterIn


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email.lower()))
    if not user or not verify_password(password, user.password_hash):
        raise ApiError(401, "invalid_credentials")
    return user


async def register(db: AsyncSession, body: RegisterIn) -> User:
    email = body.email.lower()
    if await db.scalar(select(User.id).where(User.email == email)):
        raise ApiError(409, "email_taken")
    # Đăng ký công khai chỉ tạo tài khoản học sinh; giáo viên do quản trị viên cấp.
    user = User(email=email, password_hash=hash_password(body.password), full_name=body.full_name.strip(), role="student", grade=body.grade)
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
    if not user:
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
