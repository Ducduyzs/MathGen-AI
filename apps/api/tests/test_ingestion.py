import io
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import pytest

from app.modules.exams.generator import Rng
from app.modules.ingestion.pipeline import RULES, Structure, generate_variants, run_pipeline, solve
from app.modules.ingestion.pipeline.split import split_questions
from app.modules.ingestion.pipeline.structure import recognize
from app.modules.ingestion.pipeline.sympy_check import verify

SAMPLE = """ĐỀ KIỂM TRA 45 PHÚT – ĐẠI SỐ
Câu 1. Giải phương trình 3(x – 2) = 2x + 1.
Câu 2. Giải phương trình x² – 5x + 6 = 0.
Câu 3. Tìm m để phương trình x² – 4x + m = 0 có hai nghiệm phân biệt.
Câu 4. Giải bất phương trình –3x + 2 ≤ 11.
Câu 5. Phân tích đa thức x² – 9 thành nhân tử.
Câu 6. Cho hàm số y = 2x + 3. Tính giá trị của y khi x = –1.
Câu 7. Tìm giá trị nhỏ nhất của hàm số y = x² – 4x + 1.
Câu 8. Nghiệm của phương trình 2x + 5 = 11 là
A. x = 2   B. x = 3   C. x = 8   D. x = –3
Câu 9. Giải bất phương trình x² – 3x – 4 < 0.
Câu 10. Giải phương trình 2x² + 3x – 2 = 0.
Câu 11. Cho tam giác ABC vuông tại A, đường cao AH. Chứng minh AB² = BH·BC."""

KINDS = ["linear_equation", "quadratic_equation", "quadratic_param", "linear_inequality", "factorization",
         "function_value", "min_value", "linear_equation", "quadratic_inequality", "quadratic_equation", None]


def structures() -> dict[str, Structure]:
    out = {}
    for q in split_questions(SAMPLE):
        rec = recognize(q.stem)
        if rec.ok:
            out.setdefault(rec.structure.kind, rec.structure)
    out["vertex"] = recognize("Tìm tọa độ đỉnh của parabol $y = x^2 - 6x + 5$.").structure
    return out


# ---------------------------------------------------------------- pipeline (hàm thuần)

def test_pipeline_de_mau():
    items = run_pipeline(SAMPLE, "src", {}, {})
    assert [(i["structure"] or {}).get("kind") for i in items] == KINDS
    assert items[7]["matched_choice"] == "B" and len(items[7]["choices"]) == 4
    assert items[1]["answer_display"] == r"$S = \left\{2;\ 3\right\}$"
    assert items[10]["status"] == "unrecognized" and items[10]["reason"]
    assert all(c["passed"] for i in items for c in i["checks"])


def test_chong_trung_dang_chuan():
    text = "Câu 1. Giải phương trình x^2 - 5x + 6 = 0.\nCâu 2. Giải phương trình 2x^2 - 10x + 12 = 0.\nCâu 3. Giải phương trình 6 + x^2 = 5x."
    items = run_pipeline(text, "src", {}, {})
    assert [i["duplicate_of"] for i in items] == [None, "Câu 1", "Câu 1"]
    assert len({i["structure"]["hash"] for i in items}) == 1


@pytest.mark.parametrize("kind", ["linear_equation", "quadratic_equation", "quadratic_param", "linear_inequality", "quadratic_inequality",
                                  "factorization", "function_value", "vertex", "min_value"])
def test_sympy_dong_y_voi_bo_giai(kind):
    s = structures()[kind]
    assert verify(s, solve(s))


@pytest.mark.parametrize("kind", ["linear_equation", "quadratic_equation", "quadratic_param", "linear_inequality", "quadratic_inequality",
                                  "factorization", "function_value", "vertex", "min_value"])
@pytest.mark.parametrize("fmt", ["original", "choice", "short"])
def test_bien_the_qua_kiem_chung(kind, fmt):
    s = structures()[kind]
    codes = [r.code for r in RULES if kind in r.kinds and r.code != "nhan_he_so"]
    vs = generate_variants(s, 5, codes, "same", fmt, {}, {}, Rng(3))
    accepted = [v for v in vs if v.accepted]
    assert accepted, (kind, fmt)
    for v in accepted:
        assert verify(v.structure, solve(v.structure))  # SymPy xác nhận cả biến thể
        if fmt == "choice":
            assert len(v.choices) == 4 and v.answer == {"type": "choice", "value": v.answer_display[0]}
        if fmt == "short":
            assert v.answer_short is not None and v.answer["type"] == "number"


def test_nhan_he_so_bi_loai_vi_trung_de_goc():
    s = structures()["quadratic_equation"]
    from app.modules.ingestion.pipeline import canonical_key

    vs = generate_variants(s, 3, ["nhan_he_so"], "same", "original", {}, {canonical_key(s): "Câu 2"}, Rng(1))
    assert vs and not any(v.accepted for v in vs)
    assert any("Trùng với Câu 2" in c["label"] for v in vs for c in v.checks)


# ---------------------------------------------------------------- API

def docx_bytes(paragraphs: list[str]) -> bytes:
    w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    body = "".join(f"<w:p><w:r><w:t>{escape(p)}</w:t></w:r></w:p>" for p in paragraphs)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", f'<w:document xmlns:w="{w}"><w:body>{body}</w:body></w:document>')
    return buf.getvalue()


async def upload(client, headers, name: str, data: bytes) -> str:
    r = await client.post("/api/ingestion/upload-url", json={"filename": name, "content_type": "application/octet-stream", "size": len(data)},
                          headers=headers)
    assert r.status_code == 200, r.text
    u = r.json()
    put = await client.put(u["upload_url"], content=data)
    assert put.status_code == 200, put.text
    return u["file_key"]


async def test_hoc_sinh_khong_dung_duoc(client, student):
    assert (await client.get("/api/ingestion/sources", headers=student)).status_code == 403


async def test_kiem_tra_file(client, teacher):
    bad = await client.post("/api/ingestion/upload-url", json={"filename": "de.exe", "size": 10}, headers=teacher)
    big = await client.post("/api/ingestion/upload-url", json={"filename": "de.pdf", "size": 30 * 1024 * 1024}, headers=teacher)
    assert (bad.status_code, bad.json()["code"]) == (422, "unsupported_file")
    assert (big.status_code, big.json()["code"]) == (413, "file_too_large")
    u = (await client.post("/api/ingestion/upload-url", json={"filename": "de.txt", "size": 5}, headers=teacher)).json()
    forged = re.sub(r"sig=\w+", "sig=" + "0" * 64, u["upload_url"])
    assert (await client.put(forged, content=b"hello")).status_code == 403
    missing = await client.post("/api/ingestion/sources", json={"name": "x", "file_key": u["file_key"]}, headers=teacher)
    assert missing.json()["code"] == "upload_missing"
    empty = await client.post("/api/ingestion/sources", json={"name": "x", "text": "   "}, headers=teacher)
    assert empty.json()["code"] == "empty_text"


async def test_tai_file_word_va_xem_ket_qua(client, teacher):
    key = await upload(client, teacher, "de-kiem-tra.docx", docx_bytes(SAMPLE.splitlines()))
    r = await client.post("/api/ingestion/sources", json={"name": "", "file_key": key}, headers=teacher)
    assert r.status_code == 201, r.text
    src = r.json()  # test chạy Celery eager: pipeline xong ngay trong request
    assert src["status"] == "done", src["error"]
    assert src["name"] == "de-kiem-tra.docx" and src["origin"] == "file"
    assert [s["state"] for s in src["steps"]] == ["done"] * 5
    # Đề mẫu trùng nhiều bài của ngân hàng mẫu (cùng dạng chuẩn), ví dụ x² – 5x + 6 = 0 là p09
    assert src["stats"] == {"total": 11, "recognized": 10, "duplicates": sum(bool(i["duplicate_of"]) for i in src["items"])}
    assert src["items"][1]["duplicate_of"] == "p09" and src["stats"]["duplicates"] >= 1
    item = src["items"][1]
    assert not {k for k in item if k.startswith("_")}  # cấu trúc nội bộ không lộ ra API
    assert item["checks"][-1] == {"label": "Kiểm chứng độc lập bằng SymPy: cùng kết quả với bộ giải", "passed": True}
    assert (await client.get(f"/api/ingestion/sources/{src['id']}", headers=teacher)).json()["items"] == src["items"]
    assert (await client.get("/api/ingestion/sources", headers=teacher)).json()[0]["id"] == src["id"]


async def test_anh_can_ocr_bao_loi_o_buoc_trich_xuat(client, teacher):
    key = await upload(client, teacher, "de.png", b"\x89PNG fake")
    src = (await client.post("/api/ingestion/sources", json={"name": "Ảnh", "file_key": key}, headers=teacher)).json()
    assert src["status"] == "failed" and "OCR" in src["error"]
    assert [s["state"] for s in src["steps"]] == ["done", "failed", "pending", "pending", "pending"]


async def test_sinh_bien_the_gui_duyet_va_vao_ngan_hang(client, teacher, student):
    src = (await client.post("/api/ingestion/sources", json={"name": "Dán", "text": SAMPLE}, headers=teacher)).json()
    item = src["items"][1]  # x² – 5x + 6 = 0 → trùng bài p09 trong ngân hàng mẫu
    assert item["duplicate_of"] == "p09"
    rules = [r["code"] for r in item["rules"]]
    bad = await client.post("/api/generation/variants", json={"item_id": item["id"], "count": 4, "rules": rules}, headers=teacher)
    assert bad.status_code == 422
    vs = (await client.post("/api/generation/variants", json={"item_id": item["id"], "count": 5, "rules": rules, "target": "same",
                                                               "format": "short"}, headers=teacher)).json()
    accepted = [v for v in vs if v["accepted"]]
    assert 1 <= len(accepted) <= 5 and all(v["answer_short"] for v in accepted)

    r = await client.post("/api/generation/variants/submit", json={"variant_ids": [v["id"] for v in accepted]}, headers=teacher)
    assert r.json() == {"added": len(accepted)}
    again = await client.post("/api/generation/variants/submit", json={"variant_ids": [v["id"] for v in accepted]}, headers=teacher)
    assert again.status_code == 422  # đã gửi rồi thì không gửi lại

    queue = (await client.get("/api/review/queue", headers=teacher)).json()
    rv = next(q for q in queue if q["statement"] == accepted[0]["statement"])
    assert rv["origin"] == "generated" and rv["parent"]["id"] == item["id"]
    assert (await client.post(f"/api/review/{rv['id']}", json={"decision": "approve"}, headers=teacher)).status_code == 204

    # Bài đã duyệt nằm trong ngân hàng và chấm được bằng đáp số
    page = (await client.get("/api/problems", params={"skill": "quadratic_equation"}, headers=student)).json()
    p = next(x for x in page["items"] if x["statement"] == accepted[0]["statement"])
    assert p["answer_type"] == "number"
    res = await client.post("/api/attempts", json={"client_attempt_id": "gen-variant-0001", "problem_id": p["id"],
                                                   "answer": {"type": "number", "value": accepted[0]["answer_short"]}, "time_ms": 1000},
                            headers=student)
    assert res.json()["is_correct"] is True

    # Tải lại cùng đề: câu vừa vào ngân hàng giờ bị đánh dấu trùng
    src2 = (await client.post("/api/ingestion/sources", json={"name": "Lại", "text": f"Câu 1. {accepted[0]['statement']}"}, headers=teacher)).json()
    assert src2["items"][0]["duplicate_of"] == p["id"]


async def test_khong_xem_duoc_tai_lieu_cua_nguoi_khac(client, teacher):
    from tests.conftest import login

    admin = await login(client, "admin@mathgen.vn")
    src = (await client.post("/api/ingestion/sources", json={"name": "Riêng", "text": "Câu 1. Giải phương trình 2x = 4."}, headers=teacher)).json()
    assert (await client.get(f"/api/ingestion/sources/{src['id']}", headers=admin)).status_code == 404
    gen = await client.post("/api/generation/variants", json={"item_id": src["items"][0]["id"], "count": 3, "rules": ["doi_he_so"]}, headers=admin)
    assert gen.status_code == 404


def test_khong_doc_file_ngoai_thu_muc():
    from app.modules.ingestion import storage

    with pytest.raises(ValueError):
        storage.read("../../.env")
    assert Path(storage.__file__).exists()
