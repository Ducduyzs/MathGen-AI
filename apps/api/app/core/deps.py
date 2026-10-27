from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import ApiError
from app.core.security import decode_access_token
from app.modules.users.models import User

Db = Annotated[AsyncSession, Depends(get_db)]


async def current_user(db: Db, authorization: Annotated[str | None, Header()] = None) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(401, "unauthorized")
    payload = decode_access_token(authorization.removeprefix("Bearer ").strip())
    user = await db.get(User, payload["sub"]) if payload else None
    if not user:
        raise ApiError(401, "unauthorized")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def require_roles(*roles: str):
    async def check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ApiError(403, "forbidden")
        return user

    return check


Teacher = Annotated[User, Depends(require_roles("teacher", "admin"))]
