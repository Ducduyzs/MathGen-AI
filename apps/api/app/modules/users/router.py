from typing import Annotated

from fastapi import APIRouter, Cookie, Response

from app.core.config import get_settings
from app.core.deps import CurrentUser, Db
from app.core.security import create_access_token
from app.modules.users import service
from app.modules.users.schemas import AccessOut, LoginIn, RegisterIn, SessionOut, UserOut

router = APIRouter(tags=["auth"])
COOKIE = "refresh_token"


def _set_cookie(resp: Response, token: str) -> None:
    s = get_settings()
    # Path=/ để middleware Next.js thấy cookie khi chặn trang cần đăng nhập; httpOnly nên JS không đọc được.
    resp.set_cookie(COOKIE, token, max_age=s.refresh_token_days * 86400, httponly=True, secure=s.cookie_secure, samesite="lax", path="/")


@router.post("/auth/login", response_model=SessionOut)
async def login(body: LoginIn, db: Db, response: Response):
    user = await service.authenticate(db, body.email, body.password)
    access, refresh = await service.issue_session(db, user)
    _set_cookie(response, refresh)
    return SessionOut(access_token=access, user=UserOut.model_validate(user))


@router.post("/auth/register", response_model=SessionOut, status_code=200)
async def register(body: RegisterIn, db: Db, response: Response):
    user = await service.register(db, body)
    access, refresh = await service.issue_session(db, user)
    _set_cookie(response, refresh)
    return SessionOut(access_token=access, user=UserOut.model_validate(user))


@router.post("/auth/refresh", response_model=AccessOut)
async def refresh(db: Db, refresh_token: Annotated[str | None, Cookie()] = None):
    user = await service.user_from_refresh(db, refresh_token)
    return AccessOut(access_token=create_access_token(user.id, user.role))


@router.post("/auth/logout", status_code=204)
async def logout(db: Db, refresh_token: Annotated[str | None, Cookie()] = None):
    await service.revoke(db, refresh_token)
    resp = Response(status_code=204)
    resp.delete_cookie(COOKIE, path="/")
    return resp


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user
