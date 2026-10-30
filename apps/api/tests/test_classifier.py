import pytest

from app.modules.classifier import service as classifier

FAKE = {"topic": "algebra", "topic_label": "Đại số", "topic_confidence": 0.97, "grade_band": "lower_secondary", "grade_band_label": "THCS",
        "grade_band_confidence": 0.9, "grade": 8, "grade_confidence": 0.7, "difficulty": 0.3, "level": "Thông hiểu"}


@pytest.fixture
def fake_model(monkeypatch):
    monkeypatch.setattr(classifier, "_ensure", lambda: True)
    monkeypatch.setattr(classifier, "PREDICT", lambda texts: [dict(FAKE) for _ in texts])


async def test_chua_bat_mo_hinh_thi_tat_tinh_nang(client, teacher, student):
    s = (await client.get("/api/classifier/status", headers=teacher)).json()
    assert s["available"] is False and s["reason"]
    r = await client.post("/api/classifier/predict", json={"texts": ["Giải phương trình 2x = 4."]}, headers=teacher)
    assert r.status_code == 503 and r.json()["code"] == "classifier_unavailable"
    assert (await client.post("/api/classifier/predict", json={"texts": ["abc"]}, headers=student)).status_code == 403
    # Tải đề vẫn chạy bình thường, chỉ không có nhận định AI
    src = (await client.post("/api/ingestion/sources", json={"name": "x", "text": "Câu 1. Giải phương trình 2x - 4 = 0.\nCâu 2. Vẽ hình."},
                             headers=teacher)).json()
    assert src["status"] == "done" and all(i.get("ai") is None for i in src["items"])


async def test_phan_loai_va_gan_vao_de_tai_len(client, teacher, fake_model):
    r = await client.post("/api/classifier/predict", json={"texts": ["Giải phương trình 2x = 4.", "Tính BC."]}, headers=teacher)
    assert r.status_code == 200 and [p["topic"] for p in r.json()] == ["algebra", "algebra"]
    src = (await client.post("/api/ingestion/sources", json={"name": "AI", "text": "Câu 1. Giải phương trình 2x - 4 = 0.\nCâu 2. Cho tam giác ABC. Tính BC."},
                             headers=teacher)).json()
    # Mọi câu đều có nhận định AI, kể cả câu pipeline chưa nhận dạng được dạng bài
    assert [i["status"] for i in src["items"]] == ["recognized", "unrecognized"]
    assert all(i["ai"]["topic_label"] == "Đại số" and i["ai"]["grade"] == 8 for i in src["items"])
