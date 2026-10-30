from sqlalchemy import select

from app.modules.exams.models import ExamQuestion
from app.modules.ingestion.pipeline import extract, ocr
from tests.test_classroom import new_student
from tests.test_ingestion import upload

DE = """ĐỀ KIỂM TRA 15 PHÚT – lớp 8 (thầy cô cho)
Câu 1. Giải phương trình 3x - 12 = 0.
Câu 2. Giải phương trình 2(x + 1) = x + 7.
Câu 3. Giải phương trình x^2 - 7x + 10 = 0.
Câu 4. Cho tam giác ABC vuông tại A. Tính BC."""


async def answers_of(exam_id: str) -> dict:
    from app.core.db import SessionLocal

    async with SessionLocal() as db:
        return {q.id: q.answer for q in await db.scalars(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id))}


async def test_hoc_sinh_dan_de_roi_tao_de_tuong_tu(client):
    h = await new_student(client, "Tự Ôn Tập")
    src = await client.post("/api/ingestion/sources", json={"name": "Đề thầy Nam", "text": DE}, headers=h)
    assert src.status_code == 201, src.text
    src = src.json()
    assert src["status"] == "done" and src["stats"]["total"] == 4 and src["stats"]["recognized"] == 3

    # Tự luận: câu có một đáp số → trả lời ngắn; phương trình bậc hai (tập nghiệm) → trắc nghiệm để vẫn chấm tự động
    exam = await client.post("/api/exams/similar", json={"source_id": src["id"], "per_question": 2, "mode": "written"}, headers=h)
    assert exam.status_code == 201, exam.text
    exam = exam.json()
    qs = exam["questions"]
    assert len(qs) == 6 and exam["title"].startswith("Đề tương tự · Đề thầy Nam · 6 câu")
    assert {q["template"]["code"] for q in qs} == {"similar"} and sum(q["type"] == "number" for q in qs) >= 4
    assert all(q["statement"] != s for q in qs for s in ("Giải phương trình $3x - 12 = 0$.",))  # số liệu mới, không chép lại đề gốc

    # Nộp đúng đáp án: được 10 điểm; câu tương tự không vào "ôn dạng đã sai"
    answers = await answers_of(exam["id"])
    result = (await client.post(f"/api/exams/{exam['id']}/submit", json={"answers": answers}, headers=h)).json()["result"]
    assert result["correct"] == 6 and result["score"] == 10 and result["wrong_templates"] == []

    choice = (await client.post("/api/exams/similar", json={"source_id": src["id"], "per_question": 1, "mode": "choice", "target": "harder"},
                                headers=h)).json()
    assert len(choice["questions"]) == 3 and all(q["type"] == "choice" and len(q["choices"]) == 4 for q in choice["questions"])


async def test_tai_anh_de_doc_bang_ocr(client, monkeypatch):
    monkeypatch.setattr(ocr, "available", lambda: True)
    monkeypatch.setattr(extract, "OCR", lambda data, mime: DE if mime == "image/jpeg" else "")
    h = await new_student(client, "Chụp Ảnh Đề")
    key = await upload(client, h, "anh-de.jpg", b"\xff\xd8\xff fake jpeg")
    src = (await client.post("/api/ingestion/sources", json={"name": "Ảnh đề", "file_key": key}, headers=h)).json()
    assert src["status"] == "done" and src["stats"]["recognized"] == 3
    exam = await client.post("/api/exams/similar", json={"source_id": src["id"]}, headers=h)
    assert exam.status_code == 201 and len(exam.json()["questions"]) >= 3


async def test_chi_dung_de_cua_minh(client, student):
    h = await new_student(client, "Chủ Đề")
    src = (await client.post("/api/ingestion/sources", json={"name": "Riêng", "text": DE}, headers=h)).json()
    assert (await client.get(f"/api/ingestion/sources/{src['id']}", headers=student)).status_code == 404
    assert (await client.post("/api/exams/similar", json={"source_id": src["id"]}, headers=student)).status_code == 404
    none = (await client.post("/api/ingestion/sources", json={"name": "Hình", "text": "Câu 1. Cho tam giác ABC. Tính BC.\nCâu 2. Vẽ hình."},
                              headers=h)).json()
    assert (await client.post("/api/exams/similar", json={"source_id": none["id"]}, headers=h)).json()["code"] == "no_similar"
