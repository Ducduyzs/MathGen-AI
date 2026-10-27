import httpx
import pytest

from app.modules.crawler import fetch, html, policy
from tests.conftest import login

SITE = "https://de-mau.example"
ROBOTS = "User-agent: *\nDisallow: /de-thi/rieng/\n\nUser-agent: MathGenBot\nDisallow: /de-thi/rieng/\nCrawl-delay: 1\n"
INDEX = f"""<html><head><title>Đề thi mẫu</title></head><body>
<nav><a href="/tin-tuc/">Tin tức</a></nav>
<a href="/de-thi/de-1.html">Đề 1</a> <a href="de-2.html#cau-1">Đề 2</a>
<a href="/de-thi/rieng/de-an.html">Đề riêng</a> <a href="https://ngoai.example/de.html">Ngoài</a>
<a href="/de-thi/trong.html">Không có câu</a> <a href="/de-thi/an-noindex.html">Noindex</a>
<a href="/de-thi/chuyen-huong">Chuyển hướng</a> <a href="/anh/logo.png">Logo</a>
</body></html>"""
DE_1 = """<html><head><title>Đề kiểm tra Đại số 8</title><script>var x = "Câu 9. Giải phương trình 9x = 9.";</script></head><body>
<p><b>Câu 1.</b> Giải phương trình 3(x – 4) = 2x + 5.</p>
<p><b>Câu 2.</b> Giải phương trình x<sup>2</sup> - 9x + 20 = 0.</p>
<p><b>Câu 3.</b> Giải phương trình x<sup>2</sup> - 5x + 6 = 0.</p>
<p><b>Câu 4.</b> Cho tam giác ABC vuông tại A. Tính BC.</p>
</body></html>"""
DE_2 = "<html><body><p>Bài 1: Giải phương trình 4x - 8 = 0.</p><p>Bài 2: Giải phương trình 5x + 10 = 0.</p></body></html>"


def site(request: httpx.Request) -> httpx.Response:
    if request.url.host != "de-mau.example":
        raise AssertionError(f"bộ gom gọi ra ngoài phạm vi: {request.url}")
    if not request.headers["user-agent"].startswith("MathGenBot/"):
        raise AssertionError("bộ gom phải tự xưng danh")
    pages = {
        "/robots.txt": ("text/plain", ROBOTS),
        "/de-thi/": ("text/html; charset=utf-8", INDEX),
        "/de-thi/de-1.html": ("text/html", DE_1),
        "/de-thi/de-2.html": ("text/html", DE_2),
        "/de-thi/trong.html": ("text/html", "<html><body><p>Lịch thi học kì.</p></body></html>"),
        "/de-thi/an-noindex.html": ("text/html", '<html><head><meta name="robots" content="noindex"></head><body>Câu 1. Giải phương trình 2x = 4. Câu 2. Giải phương trình 3x = 9.</body></html>'),
        "/de-thi/rieng/de-an.html": ("text/html", DE_1),
    }
    if request.url.path == "/de-thi/chuyen-huong":
        return httpx.Response(302, headers={"location": "https://ngoai.example/de.html"})
    if request.url.path not in pages:
        return httpx.Response(404, text="không có")
    ct, body = pages[request.url.path]
    return httpx.Response(200, headers={"content-type": ct}, content=body.encode())


@pytest.fixture
def fake_web(monkeypatch):
    monkeypatch.setattr(fetch, "CLIENT_FACTORY", lambda: httpx.Client(transport=httpx.MockTransport(site), headers={"User-Agent": policy.USER_AGENT}))
    monkeypatch.setattr(fetch, "PUBLIC_HOST_CHECK", lambda host: host == "de-mau.example")
    monkeypatch.setattr(fetch, "sleep", lambda s: None)


@pytest.fixture
async def admin(client):
    return await login(client, "admin@mathgen.vn")


SOURCE = {"name": "Đề mẫu", "start_urls": [f"{SITE}/de-thi/"], "include_paths": ["/de-thi/"], "license": "cc_by", "confirm": True,
          "max_pages": 20, "max_depth": 2, "delay_seconds": 1}


# ---------------------------------------------------------------- hàm thuần

def test_url_va_pham_vi():
    assert policy.normalize("de-2.html#cau-1", f"{SITE}/de-thi/") == f"{SITE}/de-thi/de-2.html"
    assert policy.normalize("mailto:a@b.c") is None and policy.normalize("HTTPS://De-Mau.Example:443/x") == f"{SITE}/x"
    assert policy.in_scope(f"{SITE}/de-thi/a.html", "de-mau.example", ["/de-thi/"])
    assert not policy.in_scope(f"{SITE}/tin-tuc/", "de-mau.example", ["/de-thi/"])
    assert not policy.in_scope("https://ngoai.example/de-thi/a.html", "de-mau.example", [])
    assert not policy.in_scope(f"{SITE}/de-thi/logo.png", "de-mau.example", [])
    assert not policy.is_public_host("localhost") and not policy.is_public_host("127.0.0.1") and not policy.is_public_host("10.0.0.5")


def test_tach_html():
    page = html.parse(DE_1)
    assert page.title == "Đề kiểm tra Đại số 8" and "Câu 9" not in page.text  # bỏ nội dung trong <script>
    assert "x^2 - 9x + 20 = 0" in page.text and page.text.count("Câu") == 4


# ---------------------------------------------------------------- API

async def test_chi_quan_tri_vien_va_kiem_tra_nguon(client, admin, teacher, fake_web):
    assert (await client.get("/api/crawler/sources", headers=teacher)).status_code == 403
    no_confirm = await client.post("/api/crawler/sources", json={**SOURCE, "confirm": False}, headers=admin)
    assert no_confirm.status_code == 422
    no_proof = await client.post("/api/crawler/sources", json={**SOURCE, "license": "permission"}, headers=admin)
    assert no_proof.status_code == 422  # "có văn bản cho phép" phải kèm bằng chứng
    two_domains = await client.post("/api/crawler/sources", json={**SOURCE, "start_urls": [f"{SITE}/de-thi/", "https://ngoai.example/"]}, headers=admin)
    assert two_domains.json()["code"] == "crawl_one_domain"
    outside = await client.post("/api/crawler/sources", json={**SOURCE, "start_urls": [f"{SITE}/tin-tuc/"]}, headers=admin)
    assert outside.json()["code"] == "crawl_out_of_scope"
    private = await client.post("/api/crawler/sources", json={**SOURCE, "start_urls": ["http://localhost/de-thi/"]}, headers=admin)
    assert private.json()["code"] == "crawl_private_host"

    src = (await client.post("/api/crawler/sources", json=SOURCE, headers=admin)).json()
    assert src["domain"] == "de-mau.example" and src["status"] == "active" and src["license_label"] == "CC BY"
    robots = (await client.post(f"/api/crawler/sources/{src['id']}/robots", headers=admin)).json()
    assert robots == [{"url": f"{SITE}/de-thi/", "allowed": True, "reason": None, "crawl_delay": 1.0}]


async def test_thu_thap_dung_pham_vi_va_dua_vao_hang_cho_duyet(client, admin, fake_web):
    src = (await client.post("/api/crawler/sources", json=SOURCE, headers=admin)).json()
    job = (await client.post(f"/api/crawler/sources/{src['id']}/jobs", headers=admin)).json()
    detail = (await client.get(f"/api/crawler/jobs/{job['id']}", headers=admin)).json()
    assert detail["status"] == "done", detail
    by_url = {p["url"].removeprefix(SITE): p for p in detail["pages"]}
    assert by_url["/de-thi/rieng/de-an.html"]["status"] == "blocked"  # robots.txt cấm
    assert by_url["/de-thi/an-noindex.html"]["status"] == "blocked"  # trang tự đặt noindex
    assert by_url["/de-thi/trong.html"]["status"] == "no_questions"
    assert by_url["/de-thi/chuyen-huong"]["status"] == "error"  # chuyển hướng ra tên miền khác: không theo
    assert "/tin-tuc/" not in by_url and "/anh/logo.png" not in by_url
    de1, de2 = by_url["/de-thi/de-1.html"], by_url["/de-thi/de-2.html"]
    # 4 câu: 2 câu mới gửi duyệt, 1 câu trùng ngân hàng (p09) và 1 câu hình chưa nhận dạng được thì không gửi
    assert de1["status"] == "fetched" and de1["questions"] == 4 and de1["submitted"] == 2 and de1["ingestion_source_id"]
    assert de2["status"] == "fetched" and de2["questions"] == 2 and de2["submitted"] == 2
    assert detail["documents"] == 2 and detail["submitted"] == de1["submitted"] + de2["submitted"]

    # Bài vào hàng chờ duyệt ghi rõ nguồn và giấy phép
    queue = (await client.get("/api/review/queue", headers=admin)).json()
    crawled = [r for r in queue if (r.get("source") or {}).get("site") == "de-mau.example"]
    assert len(crawled) == detail["submitted"]
    assert all(r["source"]["url"].startswith(SITE) and r["source"]["license"] == "CC BY" for r in crawled)

    # Thu thập lại: nội dung không đổi thì bỏ qua, không gửi trùng
    again = (await client.post(f"/api/crawler/sources/{src['id']}/jobs", headers=admin)).json()
    redo = (await client.get(f"/api/crawler/jobs/{again['id']}", headers=admin)).json()
    assert redo["status"] == "done" and redo["submitted"] == 0
    assert {p["status"] for p in redo["pages"] if p["url"].endswith(("de-1.html", "de-2.html"))} == {"unchanged"}


async def test_tam_dung_nguon_thi_khong_chay(client, admin, fake_web):
    src = (await client.post("/api/crawler/sources", json=SOURCE, headers=admin)).json()
    paused = (await client.patch(f"/api/crawler/sources/{src['id']}", json={"status": "paused"}, headers=admin)).json()
    assert paused["status"] == "paused"
    assert (await client.post(f"/api/crawler/sources/{src['id']}/jobs", headers=admin)).json()["code"] == "crawl_paused"
