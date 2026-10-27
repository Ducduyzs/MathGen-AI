from app.seed.__main__ import DATA


async def test_ky_nang_va_loc_bai(client):
    assert len((await client.get("/api/skills")).json()) == 19  # 8 kỹ năng tiểu học + 11 kỹ năng lớp 6–12
    # 18 bài mẫu lớp 6–12 (danh sách xếp theo lớp nên lấy từng lớp; test khác có thể đã thêm bài duyệt từ biến thể)
    ids = {p["id"] for g in range(6, 13) for p in (await client.get("/api/problems", params={"grade": g})).json()["items"]}
    assert {f"p{i:02d}" for i in range(1, 19)} <= ids
    primary = (await client.get("/api/problems", params={"grade": 1})).json()["items"]
    assert primary and all(p["grade"] == 1 and p["skill"]["code"].startswith("p_") for p in primary)
    grade9 = (await client.get("/api/problems", params={"grade": 9})).json()["items"]
    assert grade9 and all(p["grade"] == 9 for p in grade9)
    hard = (await client.get("/api/problems", params={"level": 4})).json()["items"]  # Vận dụng cao: độ khó ≥ 0,75
    assert hard and all(p["difficulty"] >= 0.75 for p in hard)
    found = (await client.get("/api/problems", params={"q": "x^2 - 5x + 6"})).json()["items"]
    assert {p["id"] for p in found} == {"p07", "p09"}  # phân tích nhân tử và giải phương trình cùng tam thức


async def test_bai_cong_khai_khong_lo_dap_an(client):
    p = (await client.get("/api/problems/p06")).json()
    assert p["skill"] == {"code": "factorization", "name": "Phân tích nhân tử"}
    assert len(p["choices"]) == 4 and p["hints"]
    for secret in ("answer", "answer_display", "solution"):
        assert secret not in p
    assert (await client.get("/api/problems/khong-co")).status_code == 404


async def test_hang_cho_duyet(client, student, teacher):
    assert (await client.get("/api/review/queue", headers=student)).status_code == 403
    queue = (await client.get("/api/review/queue", headers=teacher)).json()
    seed_ids = {r["id"] for r in DATA["review_items"]}
    assert seed_ids <= {q["id"] for q in queue} and {q["origin"] for q in queue} >= {"generated", "extracted"}

    target = next(q["id"] for q in queue if q["id"] in seed_ids)
    bad = await client.post(f"/api/review/{target}", json={"decision": "reject"}, headers=teacher)
    assert bad.status_code == 422  # từ chối phải có lý do
    ok = await client.post(f"/api/review/{target}", json={"decision": "reject", "reason": "Trùng bài gốc"}, headers=teacher)
    assert ok.status_code == 204
    assert target not in [q["id"] for q in (await client.get("/api/review/queue", headers=teacher)).json()]
    again = await client.post(f"/api/review/{target}", json={"decision": "approve"}, headers=teacher)
    assert again.status_code == 404
