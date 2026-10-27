async def test_ky_nang_va_loc_bai(client):
    assert len((await client.get("/api/skills")).json()) == 11
    all_ = (await client.get("/api/problems")).json()
    assert all_["total"] == 18
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
    assert len(queue) == 4 and {q["origin"] for q in queue} == {"generated", "extracted"}

    target = queue[0]["id"]
    bad = await client.post(f"/api/review/{target}", json={"decision": "reject"}, headers=teacher)
    assert bad.status_code == 422  # từ chối phải có lý do
    ok = await client.post(f"/api/review/{target}", json={"decision": "reject", "reason": "Trùng bài gốc"}, headers=teacher)
    assert ok.status_code == 204
    assert target not in [q["id"] for q in (await client.get("/api/review/queue", headers=teacher)).json()]
    again = await client.post(f"/api/review/{target}", json={"decision": "approve"}, headers=teacher)
    assert again.status_code == 404
