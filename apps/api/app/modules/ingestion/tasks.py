"""Task hàng đợi `ingest`: trích xuất → tách câu → nhận dạng → giải & kiểm chứng (SymPy). Ghi tiến trình sau mỗi bước
để giao diện thấy được đang ở bước nào."""

import logging

from app.modules.ingestion import storage
from app.modules.ingestion.models import IngestionSource, Upload
from app.modules.ingestion.pipeline import Structure, run_pipeline, solve
from app.modules.ingestion.pipeline.extract import ExtractError, clean, extract_text
from app.modules.ingestion.pipeline.split import split_questions
from app.modules.ingestion.pipeline.sympy_check import verify
from app.modules.problem_bank import service as bank
from app.workers.celery_app import celery
from app.workers.db import SyncSession

log = logging.getLogger(__name__)


def _fail(db, src: IngestionSource, step: int, message: str) -> None:
    src.status, src.failed_at, src.error = "failed", step, message
    db.commit()


@celery.task(name="ingest.process_source", acks_late=True)
def process_source(source_id: str) -> str:
    with SyncSession() as db:
        src = db.get(IngestionSource, source_id)
        if not src or src.status != "processing":
            return "skip"

        # 1. Trích xuất văn bản
        try:
            if src.upload_key:
                up = db.get(Upload, src.upload_key)
                text = extract_text(up.filename, storage.read(up.key))
            else:
                text = src.text or ""
        except ExtractError as e:
            _fail(db, src, 1, str(e))
            return "failed"
        except OSError:
            log.exception("không đọc được file %s", src.upload_key)
            _fail(db, src, 1, "Không đọc được file đã tải lên.")
            return "failed"
        text = clean(text)
        if not text.strip():
            _fail(db, src, 1, "Không có nội dung để phân tích.")
            return "failed"
        src.progress = 2
        db.commit()

        # 2. Tách câu
        if not split_questions(text):
            _fail(db, src, 2, 'Không tách được câu hỏi nào. Đề cần đánh số kiểu "Câu 1.", "Bài 1:" hoặc "1.".')
            return "failed"
        src.progress = 3
        db.commit()

        # 3. Nhận dạng, giải, chống trùng
        items = run_pipeline(text, src.id, bank.bank_index_sync(db), bank.skill_names_sync(db))
        src.progress = 4
        db.commit()

        # 4. Kiểm chứng độc lập bằng SymPy
        for item in items:
            if item["_structure"]:
                s = Structure.from_json(item["_structure"])
                try:
                    ok = verify(s, solve(s))
                except Exception:  # SymPy lỗi với một bài thì đánh dấu chưa kiểm chứng, không làm hỏng cả đề
                    log.exception("sympy verify %s", item["id"])
                    ok = False
                item["checks"].append({"label": "Kiểm chứng độc lập bằng SymPy: cùng kết quả với bộ giải", "passed": ok})
        src.items, src.progress, src.status = items, 5, "done"
        db.commit()
        return "done"
