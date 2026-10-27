from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.core.deps import Db, Teacher
from app.core.errors import ApiError
from app.modules.ingestion import service
from app.modules.ingestion.pipeline.extract import MAX_UPLOAD_BYTES
from app.modules.ingestion.schemas import (
    CreateSourceIn, GenerateIn, SourceOut, SourceSummaryOut, SubmitVariantsIn, SubmitVariantsOut, UploadUrlIn, UploadUrlOut, VariantOut,
)

router = APIRouter(tags=["ingestion"])


@router.post("/ingestion/upload-url", response_model=UploadUrlOut)
async def upload_url(body: UploadUrlIn, db: Db, user: Teacher):
    return await service.create_upload_url(db, user, body)


@router.put("/ingestion/files/{key}", status_code=200)
async def put_file(key: str, request: Request, db: Db, exp: Annotated[int, Query()], sig: Annotated[str, Query(max_length=64)]):
    """Link ký sẵn: không cần token đăng nhập, chữ ký trong URL là quyền ghi (giống presigned URL của R2/S3)."""
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_UPLOAD_BYTES:  # dừng đọc sớm, không giữ file quá lớn trong bộ nhớ
            raise ApiError(413, "file_too_large")
    await service.receive_file(db, key, exp, sig, bytes(data))
    return {}


@router.post("/ingestion/sources", response_model=SourceOut, status_code=201)
async def create_source(body: CreateSourceIn, db: Db, user: Teacher):
    return await service.create_source(db, user, body)


@router.get("/ingestion/sources", response_model=list[SourceSummaryOut])
async def list_sources(db: Db, user: Teacher):
    return await service.list_sources(db, user)


@router.get("/ingestion/sources/{source_id}", response_model=SourceOut)
async def get_source(source_id: str, db: Db, user: Teacher):
    return await service.get_source(db, user, source_id)


@router.post("/generation/variants", response_model=list[VariantOut])
async def generate_variants(body: GenerateIn, db: Db, user: Teacher):
    return await service.generate(db, user, body)


@router.post("/generation/variants/submit", response_model=SubmitVariantsOut)
async def submit_variants(body: SubmitVariantsIn, db: Db, user: Teacher):
    return SubmitVariantsOut(added=await service.submit_variants(db, user, body))
