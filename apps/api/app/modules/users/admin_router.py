from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import Admin, Db
from app.modules.users import service
from app.modules.users.schemas import AdminCreateUserIn, AdminUpdateUserIn, AdminUserOut, PasswordIn, Role, UserPage

router = APIRouter(prefix="/admin/users", tags=["admin"])


@router.get("", response_model=UserPage)
async def list_users(db: Db, _: Admin, q: Annotated[str | None, Query(max_length=120)] = None, role: Role | None = None,
                     page: Annotated[int, Query(ge=1)] = 1):
    return await service.list_users(db, q, role, page)


@router.post("", response_model=AdminUserOut, status_code=201)
async def create_user(body: AdminCreateUserIn, db: Db, _: Admin):
    return await service.create_user(db, body)


@router.patch("/{user_id}", response_model=AdminUserOut)
async def update_user(user_id: str, body: AdminUpdateUserIn, db: Db, admin: Admin):
    return await service.update_user(db, admin, user_id, body)


@router.post("/{user_id}/password", status_code=204)
async def set_password(user_id: str, body: PasswordIn, db: Db, _: Admin):
    await service.set_password(db, user_id, body.password)
