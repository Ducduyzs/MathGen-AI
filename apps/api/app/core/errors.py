"""Lỗi API dạng {"code": "..."}: frontend ánh xạ code sang thông báo tiếng Việt (apps/web/src/lib/api/errors.ts)."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status: int, code: str):
        self.status = status
        self.code = code


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(_: Request, e: ApiError):
        return JSONResponse({"code": e.code}, status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, e: RequestValidationError):
        # Bỏ trường ctx (có thể chứa đối tượng Exception, không chuyển được sang JSON)
        detail = [{"loc": err["loc"], "msg": err["msg"], "type": err["type"]} for err in e.errors()[:5]]
        return JSONResponse({"code": "validation_error", "detail": detail}, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}.get(e.status_code, "error")
        return JSONResponse({"code": code}, status_code=e.status_code)
