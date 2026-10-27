import httpx
import pytest

from app.modules.crawler import fetch, policy
from app.modules.regions.data import PROVINCES
from app.modules.regions.detect import detect
from tests.test_classroom import new_student
from tests.test_crawler import admin  # noqa: F401  (fixture)

SITE = "https://so-mau.example"
DE = """<html><head><title>Đề kiểm tra cuối kì I Toán 8</title></head><body>
<p>SỞ GD&amp;ĐT BÌNH DƯƠNG</p><p>TRƯỜNG THCS NGUYỄN VĂN CỪ</p>
<p>ĐỀ KIỂM TRA CUỐI HỌC KÌ I – NĂM HỌC 2024 - 2025</p><p>Môn: Toán 8</p>
<p>Câu 1. Giải phương trình 7x - 91 = 0.</p><p>Câu 2. Giải phương trình 6x + 102 = 0.</p><p>Câu 3. Giải phương trình 9x - 171 = 0.</p>
</body></html>"""


def site(request: httpx.Request) -> httpx.Response:
    pages = {"/robots.txt": "User-agent: *\nAllow: /\n", "/de/": '<a href="/de/cuoi-ki-1.html">Đề</a>', "/de/cuoi-ki-1.html": DE}
    if request.url.path not in pages:
        return httpx.Response(404)
    ct = "text/plain" if request.url.path.endswith(".txt") else "text/html"
    return httpx.Response(200, headers={"content-type": ct}, content=pages[request.url.path].encode())


@pytest.fixture
def fake_web(monkeypatch):
    monkeypatch.setattr(fetch, "CLIENT_FACTORY", lambda: httpx.Client(transport=httpx.MockTransport(site), headers={"User-Agent": policy.USER_AGENT}))
    monkeypatch.setattr(fetch, "PUBLIC_HOST_CHECK", lambda host: host == "so-mau.example")
    monkeypatch.setattr(fetch, "sleep", lambda s: None)


def test_34_tinh_va_nhan_dien_dau_de():
    assert len(PROVINCES) == 34 and len({c for c, _ in PROVINCES}) == 34
    r = detect("", "SỞ GIÁO DỤC VÀ ĐÀO TẠO NGHỆ AN\nTRƯỜNG THPT CHUYÊN PHAN BỘI CHÂU\nĐỀ KIỂM TRA CUỐI HỌC KÌ I\nNăm học 2024 - 2025")
    assert (r.province_code, r.province_raw, r.school_name, r.school_level, r.exam_kind, r.exam_year) == (
        "nghe-an", "Nghệ An", "Trường THPT Chuyên Phan Bội Châu", "upper", "end_term", 2025)
    # Tỉnh cũ đã sáp nhập → tỉnh mới, giữ tên gốc
    old = detect("", "SỞ GD&ĐT BÌNH DƯƠNG\nKỲ THI TUYỂN SINH VÀO LỚP 10 NĂM HỌC 2023-2024")
    assert (old.province_code, old.province_raw, old.exam_kind, old.exam_year) == ("ho-chi-minh", "Bình Dương", "grade10", 2024)
    assert detect("", "Sở Giáo dục và Đào tạo Thừa Thiên Huế").province_code == "hue"
    assert detect("Đề thi vào lớp 10 môn Toán Hà Nội 2025", "Câu 1.").province_code == "ha-noi"
    # Địa danh trong đề bài (không phải phần đầu) không bị nhận nhầm
    assert detect("", "BỘ GIÁO DỤC VÀ ĐÀO TẠO\nKỲ THI TỐT NGHIỆP THPT NĂM 2025\nCâu 1. Một xe đi từ Huế ra Hà Nội").province_code is None


async def test_thu_thap_gan_tinh_truong_roi_ra_de_theo_khu_vuc(client, admin, fake_web):  # noqa: F811
    src = (await client.post("/api/crawler/sources", json={
        "name": "Sở mẫu", "start_urls": [f"{SITE}/de/"], "license": "government", "confirm": True, "delay_seconds": 1,
    }, headers=admin)).json()
    job = (await client.post(f"/api/crawler/sources/{src['id']}/jobs", headers=admin)).json()
    detail = (await client.get(f"/api/crawler/jobs/{job['id']}", headers=admin)).json()
    page = next(p for p in detail["pages"] if p["url"].endswith("cuoi-ki-1.html"))
    assert page["submitted"] == 3 and page["region"]["province_code"] == "ho-chi-minh"
    assert page["region"]["school_name"] == "Trường THCS Nguyễn Văn Cừ" and page["region"]["exam_kind"] == "end_term"

    queue = [r for r in (await client.get("/api/review/queue", headers=admin)).json() if (r.get("source") or {}).get("site") == "so-mau.example"]
    assert len(queue) == 3
    s = queue[0]["source"]
    assert (s["province_code"], s["province_name"], s["province_raw"], s["exam_year"]) == ("ho-chi-minh", "TP. Hồ Chí Minh", "Bình Dương", 2025)
    for item in queue:  # đáp số một số → chấm tự động được → vào ngân hàng khi duyệt
        assert (await client.post(f"/api/review/{item['id']}", json={"decision": "approve"}, headers=admin)).status_code == 204

    provinces = {p["code"]: p for p in (await client.get("/api/regions")).json()}
    assert len(provinces) == 34 and provinces["ho-chi-minh"]["problems"] >= 3 and provinces["ho-chi-minh"]["schools"] >= 1
    schools = (await client.get("/api/regions/ho-chi-minh/schools")).json()
    school = next(x for x in schools if x["name"] == "Trường THCS Nguyễn Văn Cừ")
    assert school["problems"] == 3 and school["level"] == "lower"
    banked = (await client.get("/api/problems", params={"province": "ho-chi-minh"})).json()["items"]
    assert len(banked) >= 3 and {"Giải phương trình $7x - 91 = 0$."} <= {p["statement"] for p in banked}

    # Học sinh lớp 8 ở TP.HCM ra đề tự luận theo trường: 3 câu đề thật + câu tự sinh cho đủ 10
    h = await new_student(client, "Học Sinh Thành Phố")
    exam = (await client.post("/api/exams", json={"mode": "written", "size": 10, "province": "ho-chi-minh", "school_id": school["id"]}, headers=h)).json()
    real = [q for q in exam["questions"] if q["template"]["code"] == "bank"]
    assert len(exam["questions"]) == 10 and len(real) == 3 and exam["title"].startswith("Đề khu vực Trường THCS Nguyễn Văn Cừ")
    answers = {q["id"]: {"type": "number", "value": "13"} for q in real}
    result = (await client.post(f"/api/exams/{exam['id']}/submit", json={"answers": answers}, headers=h)).json()["result"]
    assert result["correct"] >= 1  # 7x - 91 = 0 → x = 13
    assert all(t["code"] != "bank" for t in result["wrong_templates"])

    bad = await client.post("/api/exams", json={"mode": "written", "size": 10, "province": "khong-co"}, headers=h)
    assert bad.json()["code"] == "unknown_province"


async def test_dang_ky_kem_tinh(client):
    r = await client.post("/api/auth/register", json={"full_name": "Bạn Nghệ An", "email": "nghean@example.com", "password": "matkhau1",
                                                      "grade": 9, "province_code": "nghe-an"})
    assert r.status_code == 200 and r.json()["user"]["province_code"] == "nghe-an"
    bad = await client.post("/api/auth/register", json={"full_name": "Bạn X", "email": "x@example.com", "password": "matkhau1", "grade": 9,
                                                        "province_code": "atlantis"})
    assert bad.status_code == 422
