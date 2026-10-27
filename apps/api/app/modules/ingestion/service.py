"""Tải đề → pipeline → sinh biến thể → hàng chờ duyệt.

Phần nặng (trích xuất file, kiểm chứng SymPy) chạy trong worker `ingest` (tasks.py). Sinh biến thể chạy trong request
vì chỉ dùng số học phân số chính xác (vài chục mili giây), không gọi SymPy.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.ids import new_id
from app.modules.ingestion import storage, tasks
from app.modules.ingestion.models import GeneratedVariant, IngestionSource, Upload
from app.modules.ingestion.pipeline import Structure, generate_variants, hash_key
from app.modules.ingestion.pipeline.extract import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, extension
from app.modules.ingestion.pipeline.structure import KIND_SKILL
from app.modules.ingestion.schemas import (
    CreateSourceIn, GenerateIn, SourceOut, SourceSummaryOut, SubmitVariantsIn, UploadUrlIn, UploadUrlOut, VariantOut,
)
from app.modules.problem_bank import service as bank
from app.modules.regions import service as regions
from app.modules.users.models import User

STEPS = [("upload", "Tải lên"), ("extract", "Trích xuất văn bản"), ("split", "Tách câu hỏi"), ("recognize", "Nhận dạng dạng bài"),
         ("verify", "Giải & kiểm chứng")]
RECENT = 10


def public_item(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


def stats(items: list[dict]) -> dict:
    return {"total": len(items), "recognized": sum(i["status"] == "recognized" for i in items),
            "duplicates": sum(bool(i["duplicate_of"]) for i in items)}


def steps(src: IngestionSource) -> list[dict]:
    out = []
    for i, (key, label) in enumerate(STEPS):
        if src.failed_at == i:
            state = "failed"
        elif i < src.progress:
            state = "done"
        elif i == src.progress and src.status == "processing":
            state = "running"
        else:
            state = "pending"
        out.append({"key": key, "label": label, "state": state})
    return out


def to_out(src: IngestionSource) -> SourceOut:
    items = src.items if src.status == "done" else []
    region = src.region and {**src.region, "province_name": regions.province_name(src.region.get("province_code")),
                              "exam_kind_label": regions.EXAM_KINDS.get(src.region.get("exam_kind") or "")}
    return SourceOut(id=src.id, name=src.name, origin=src.origin, status=src.status, created_at=src.created_at,
                     stats=stats(items), steps=steps(src), error=src.error, items=[public_item(i) for i in items], region=region)


# ---------------------------------------------------------------- tải file

async def create_upload_url(db: AsyncSession, user: User, body: UploadUrlIn) -> UploadUrlOut:
    if extension(body.filename) not in ALLOWED_EXTENSIONS:
        raise ApiError(422, "unsupported_file")
    if body.size > MAX_UPLOAD_BYTES:
        raise ApiError(413, "file_too_large")
    up = Upload(user_id=user.id, filename=body.filename, content_type=body.content_type, size=body.size)
    db.add(up)
    await db.commit()
    return UploadUrlOut(upload_url=storage.signed_url(up.key), file_key=up.key)


async def receive_file(db: AsyncSession, key: str, exp: int, sig: str, data: bytes) -> None:
    if not storage.valid_signature(key, exp, sig):
        raise ApiError(403, "forbidden")
    up = await db.get(Upload, key)
    if not up:
        raise ApiError(404, "not_found")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ApiError(413, "file_too_large")
    storage.write(key, data)
    up.size, up.uploaded_at = len(data), datetime.now(UTC)
    await db.commit()


# ---------------------------------------------------------------- tài liệu

async def create_source(db: AsyncSession, user: User, body: CreateSourceIn) -> SourceOut:
    up = None
    if body.file_key:
        up = await db.get(Upload, body.file_key)
        if not up or up.user_id != user.id or not up.uploaded_at:
            raise ApiError(422, "upload_missing")
    elif not (body.text or "").strip():
        raise ApiError(422, "empty_text")
    src = IngestionSource(user_id=user.id, name=body.name.strip() or (up.filename if up else "Nội dung dán vào"),
                          origin="file" if up else "text", upload_key=up.key if up else None, text=None if up else body.text,
                          items=[], created_at=datetime.now(UTC))
    db.add(src)
    await db.commit()
    tasks.process_source.delay(src.id)  # sau commit; dev/test (eager) chạy xong ngay trong lời gọi này
    await db.refresh(src)
    return to_out(src)


async def _owned(db: AsyncSession, user: User, source_id: str) -> IngestionSource:
    src = await db.get(IngestionSource, source_id)
    if not src or src.user_id != user.id:
        raise ApiError(404, "not_found")
    return src


async def get_source(db: AsyncSession, user: User, source_id: str) -> SourceOut:
    return to_out(await _owned(db, user, source_id))


async def list_sources(db: AsyncSession, user: User) -> list[SourceSummaryOut]:
    rows = await db.scalars(select(IngestionSource).where(IngestionSource.user_id == user.id)
                            .order_by(IngestionSource.created_at.desc()).limit(RECENT))
    return [SourceSummaryOut(id=s.id, name=s.name, origin=s.origin, status=s.status, created_at=s.created_at,
                             stats=stats(s.items if s.status == "done" else [])) for s in rows]


# ---------------------------------------------------------------- sinh biến thể

async def generate(db: AsyncSession, user: User, body: GenerateIn) -> list[VariantOut]:
    source_id = body.item_id.rsplit("_c", 1)[0]
    src = await _owned(db, user, source_id)
    item = next((i for i in src.items if i["id"] == body.item_id), None)
    if not item or not item.get("_structure"):
        raise ApiError(404, "not_found")
    s = Structure.from_json(item["_structure"])
    # Chống trùng với các câu khác của chính đề tải lên và với ngân hàng
    source_keys = {i["_key"]: f"Câu {i['index']}" for i in src.items if i.get("_key")}
    variants = generate_variants(s, body.count, body.rules, body.target, body.format, await bank.bank_index(db), source_keys)
    names = await bank.skill_names(db)
    out = []
    for v in variants:
        skill, grade = KIND_SKILL[v.structure.kind]
        o = VariantOut(
            id=new_id(), item_id=item["id"], statement=v.statement, format=v.format, choices=v.choices, answer_display=v.answer_display,
            answer_short=v.answer_short, answer_prefix=v.answer_prefix, solution=v.solution, rule=v.rule, transform=v.transform,
            grade=grade, skill={"code": skill, "name": names.get(skill, skill)}, difficulty=v.difficulty, checks=v.checks, accepted=v.accepted,
        )
        payload = o.model_dump() | {"_confidence": item["confidence"], "_answer_label": v.answer_label,
                                    "_parent": {"id": item["id"], "statement": item["statement"]}}
        # Mã ULID sinh ở ứng dụng: cả lô ghi một lần khi commit, không mất một lượt đi về database cho mỗi biến thể
        db.add(GeneratedVariant(id=o.id, user_id=user.id, source_id=src.id, item_id=item["id"], payload=payload, answer=v.answer,
                                canonical_hash=hash_key(v.key), accepted=v.accepted))
        out.append(o)
    await db.commit()
    return out


async def submit_variants(db: AsyncSession, user: User, body: SubmitVariantsIn) -> int:
    rows = list(await db.scalars(select(GeneratedVariant).where(
        GeneratedVariant.id.in_(body.variant_ids), GeneratedVariant.user_id == user.id,
        GeneratedVariant.accepted.is_(True), GeneratedVariant.submitted.is_(False)).with_for_update()))
    if not rows:
        raise ApiError(422, "validation_error")
    items = []
    for r in rows:
        v = r.payload
        checks = list(v["checks"])
        if not r.answer:  # minh bạch với người duyệt: bài này chưa chấm tự động được khi vào ngân hàng
            checks.append({"label": "Đáp án dạng tập nghiệm / biểu thức: chưa chấm tự động được (chọn Trắc nghiệm hoặc Trả lời ngắn để luyện tập)",
                           "passed": False})
        items.append({
            "origin": "generated", "statement": v["statement"], "answer_display": v["answer_display"], "solution": v["solution"],
            "grade": v["grade"], "skill_code": v["skill"]["code"], "difficulty": v["difficulty"],
            "classification_confidence": v["_confidence"], "parent": v["_parent"], "transform": f"{v['rule']['label']}: {v['transform']}",
            "source": None, "choices": v["choices"] or None, "checks": checks, "answer": r.answer,
            "answer_prefix": v["_answer_label"], "canonical_hash": r.canonical_hash,
        })
        r.submitted = True
    added = await bank.add_review_items(db, items)
    await db.commit()
    return added


# ---------------------------------------------------------------- bộ gom (worker, phiên đồng bộ)

def _review_row(item: dict, provenance: dict) -> dict:
    """Câu gốc đã nhận dạng → bài chờ duyệt, ghi rõ nguồn (URL, giấy phép) để giáo viên kiểm tra trước khi đưa vào ngân hàng."""
    checks = list(item["checks"])
    if item.get("matched_choice"):
        answer = {"type": "choice", "value": item["matched_choice"]}
    elif item.get("_short") is not None and not item["choices"]:
        answer = {"type": "number", "value": item["_short"]}
    else:
        answer = None
    if not answer:
        checks.append({"label": "Đáp án dạng tập nghiệm / biểu thức: chưa chấm tự động được", "passed": False})
    return {
        "origin": "extracted", "statement": item["statement"], "answer_display": item["answer_display"], "solution": item["solution"],
        "grade": item["grade"], "skill_code": item["skill"]["code"], "difficulty": item["difficulty"],
        "classification_confidence": item["confidence"], "parent": None, "transform": None, "source": provenance,
        "choices": item["choices"] or None, "checks": checks, "answer": answer,
        "answer_prefix": item.get("_short_label") if answer and answer["type"] == "number" else None,
        "canonical_hash": item["structure"]["hash"],
    }


def ingest_crawled_sync(db: Session, user_id: str, name: str, text: str, provenance: dict, default_province: str | None = None,
                        default_school: str | None = None) -> tuple[str, int, int, dict]:
    """Văn bản bộ gom lấy về → tài liệu (origin "crawl") → pipeline 5 bước → câu nhận dạng & kiểm chứng đủ thì vào hàng chờ duyệt.

    Khu vực (tỉnh, trường, kỳ thi, năm học) lấy từ phần đầu đề, thiếu thì theo mặc định của nguồn; ghi vào `source` của từng bài.
    Trả về (mã tài liệu, số câu tách được, số câu đã gửi duyệt, khu vực). Commit trong hàm.
    """
    src = IngestionSource(user_id=user_id, name=name[:200], origin="crawl", text=text, items=[], created_at=datetime.now(UTC))
    db.add(src)
    db.commit()
    tasks.process_source(src.id)  # chạy luôn trong worker hiện tại (đã ở hàng đợi ingest)
    db.refresh(src)
    region = regions.provenance_sync(db, src.region, default_province, default_school, user_id)
    provenance = {**provenance, **region}
    good = [i for i in src.items if i["status"] == "recognized" and not i["duplicate_of"]
            and all(c["passed"] for c in i["checks"] if not c["label"].startswith("Không phương án"))]
    good = [i for i in good if i.get("matched_choice") or not i["choices"]]  # trắc nghiệm phải khớp được đáp án
    seen = bank.pending_hashes_sync(db, [i["structure"]["hash"] for i in good])
    rows = [_review_row(i, provenance) for i in good if i["structure"]["hash"] not in seen]
    bank.add_review_items_sync(db, rows)
    db.commit()
    return src.id, len(src.items), len(rows), region
