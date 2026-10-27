from datetime import datetime

from tests.test_classroom import new_class, new_student
from tests.test_exams import answers_of


async def new_parent(client, name="Nguyễn Văn Phụ") -> dict[str, str]:
    email = f"ph{datetime.now().timestamp():.0f}{len(name)}@example.com"
    r = await client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "matkhau1", "role": "parent"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "parent" and r.json()["user"]["grade"] is None
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def test_dang_ky_vai_tro(client):
    # Học sinh bắt buộc chọn lớp; không tự đăng ký làm giáo viên được
    base = {"full_name": "Hồ Văn Nam", "email": "hvn@example.com", "password": "matkhau1"}
    assert (await client.post("/api/auth/register", json=base)).status_code == 422
    assert (await client.post("/api/auth/register", json={**base, "role": "teacher", "grade": 10})).status_code == 422


async def test_lien_ket_phu_huynh_xem_tien_do(client, teacher):
    hs = await new_student(client, "Võ Thị Lan")
    ph = await new_parent(client)
    c = await new_class(client, teacher)
    await client.post("/api/classes/join", json={"code": c["join_code"]}, headers=hs)
    await client.post(f"/api/classes/{c['id']}/assignments", json={"mode": "choice", "size": 10}, headers=teacher)
    exam = (await client.post("/api/exams", json={"mode": "choice", "size": 10}, headers=hs)).json()
    await client.post(f"/api/exams/{exam['id']}/submit", json={"answers": await answers_of(exam["id"])}, headers=hs)

    # Chỉ học sinh tạo mã; chỉ phụ huynh nhập mã
    assert (await client.post("/api/me/parent-code", headers=ph)).status_code == 403
    code = (await client.post("/api/me/parent-code", headers=hs)).json()
    assert len(code["code"]) == 6
    assert (await client.post("/api/children/link", json={"code": code["code"]}, headers=hs)).status_code == 403
    assert (await client.post("/api/children/link", json={"code": "ZZZZZZ"}, headers=ph)).json()["code"] == "link_code_invalid"

    r = await client.post("/api/children/link", json={"code": code["code"].lower()}, headers=ph)
    assert r.status_code == 200, r.text
    child = r.json()
    assert child["full_name"] == "Võ Thị Lan" and child["grade"] == 10 and child["pending_assignments"] == 1
    assert child["today_problems"] == 10 and child["last_active"]
    # Mã dùng một lần
    other = await new_parent(client, "Trần Thị Mẹ")
    assert (await client.post("/api/children/link", json={"code": code["code"]}, headers=other)).status_code == 404

    report = (await client.get(f"/api/children/{child['id']}", headers=ph)).json()
    assert report["child"]["id"] == child["id"] and len(report["activity"]) == 14 and report["activity"][-1]["count"] == 10
    assert report["exams"][0]["id"] == exam["id"] and report["assignments"][0]["status"] == "todo"
    assert report["progress"]["daily_goal"] >= 1 and report["arena"] == []
    assert [x["id"] for x in (await client.get("/api/children", headers=ph)).json()] == [child["id"]]
    # Phụ huynh khác không xem được
    assert (await client.get(f"/api/children/{child['id']}", headers=other)).status_code == 404

    # Học sinh thấy phụ huynh đã liên kết và gỡ được
    parents = (await client.get("/api/me/parents", headers=hs)).json()
    assert [p["full_name"] for p in parents] == ["Nguyễn Văn Phụ"]
    assert (await client.delete(f"/api/me/parents/{parents[0]['id']}", headers=hs)).status_code == 204
    assert (await client.get(f"/api/children/{child['id']}", headers=ph)).status_code == 404
    assert (await client.get("/api/children", headers=ph)).json() == []
