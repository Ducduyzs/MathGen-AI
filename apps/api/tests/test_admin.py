import uuid

from tests.test_crawler import admin  # noqa: F401  (fixture)


async def test_chi_quan_tri_vien(client, teacher, student):
    for h in (teacher, student):
        assert (await client.get("/api/admin/users", headers=h)).status_code == 403
        assert (await client.get("/api/admin/quality", headers=h)).status_code == 403


async def test_tao_sua_khoa_tai_khoan(client, admin):  # noqa: F811
    page = (await client.get("/api/admin/users", headers=admin)).json()
    assert page["counts"]["admin"] >= 1 and page["counts"]["student"] >= 1 and page["page_size"] == 50
    found = (await client.get("/api/admin/users", params={"q": "gv@mathgen"}, headers=admin)).json()
    assert [u["email"] for u in found["items"]] == ["gv@mathgen.vn"] and found["items"][0]["last_login"]

    # Giáo viên không tự đăng ký được: quản trị viên tạo, kèm mật khẩu tạm
    body = {"full_name": "Cô Lan", "email": "co.lan@example.com", "role": "teacher", "password": "tam-thoi-123", "province_code": "nghe-an"}
    created = await client.post("/api/admin/users", json=body, headers=admin)
    assert created.status_code == 201, created.text
    lan = created.json()
    assert lan["role"] == "teacher" and lan["grade"] is None and not lan["disabled"]
    assert (await client.post("/api/admin/users", json=body, headers=admin)).json()["code"] == "email_taken"
    assert (await client.post("/api/admin/users", json={**body, "email": "x@example.com", "role": "student"}, headers=admin)).status_code == 422
    token = (await client.post("/api/auth/login", json={"email": "co.lan@example.com", "password": "tam-thoi-123"})).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    assert (await client.get("/api/me", headers=h)).json()["role"] == "teacher"

    # Đổi sang học sinh phải có lớp
    assert (await client.patch(f"/api/admin/users/{lan['id']}", json={"role": "student"}, headers=admin)).json()["code"] == "grade_required"
    upd = (await client.patch(f"/api/admin/users/{lan['id']}", json={"role": "student", "grade": 7}, headers=admin)).json()
    assert upd["role"] == "student" and upd["grade"] == 7
    assert (await client.get("/api/me", headers=h)).json()["role"] == "student"  # có hiệu lực ngay, không cần đăng nhập lại

    # Khóa: phiên đang mở bị từ chối, không đăng nhập lại được; mở khóa thì dùng lại được
    assert (await client.patch(f"/api/admin/users/{lan['id']}", json={"disabled": True}, headers=admin)).json()["disabled"]
    assert (await client.get("/api/me", headers=h)).json()["code"] == "account_disabled"
    r = await client.post("/api/auth/login", json={"email": "co.lan@example.com", "password": "tam-thoi-123"})
    assert r.status_code == 403 and r.json()["code"] == "account_disabled"
    await client.patch(f"/api/admin/users/{lan['id']}", json={"disabled": False}, headers=admin)

    # Đặt lại mật khẩu: mật khẩu cũ hết dùng được
    assert (await client.post(f"/api/admin/users/{lan['id']}/password", json={"password": "mat-khau-moi-1"}, headers=admin)).status_code == 204
    assert (await client.post("/api/auth/login", json={"email": "co.lan@example.com", "password": "tam-thoi-123"})).status_code == 401
    assert (await client.post("/api/auth/login", json={"email": "co.lan@example.com", "password": "mat-khau-moi-1"})).status_code == 200


async def test_khong_tu_ha_quyen_hay_tu_khoa(client, admin):  # noqa: F811
    me = (await client.get("/api/me", headers=admin)).json()
    for change in ({"role": "teacher"}, {"disabled": True}):
        r = await client.patch(f"/api/admin/users/{me['id']}", json=change, headers=admin)
        assert r.status_code == 409 and r.json()["code"] == "cannot_modify_self"
    assert (await client.patch(f"/api/admin/users/{me['id']}", json={"province_code": "ha-noi"}, headers=admin)).json()["province_code"] == "ha-noi"


async def test_bao_cao_chat_luong_va_bai_nghi_sai_dap_an(client, admin, student):  # noqa: F811
    # 5 lượt đều sai cùng một bài: nghi đáp án / đề có vấn đề
    for _ in range(5):
        body = {"client_attempt_id": uuid.uuid4().hex, "problem_id": "g_p5_box_volume_01", "answer": {"type": "number", "value": "1"}, "time_ms": 3000}
        assert (await client.post("/api/attempts", json=body, headers=student)).status_code == 200
    q = (await client.get("/api/admin/quality", headers=admin)).json()
    assert q["problems_total"] >= 200 and {c["key"] for c in q["by_stage"]} == {"primary", "secondary"}
    assert sum(c["count"] for c in q["by_stage"]) == q["problems_total"]
    assert len(q["coverage"]) == 19 and q["min_per_skill"] == 10
    sus = next(s for s in q["suspicious"] if s["problem_id"] == "g_p5_box_volume_01")
    assert sus["attempts"] >= 5 and sus["correct_rate"] == 0 and sus["grade"] == 5 and sus["statement"]
    assert q["attempts_week"] >= 5 and q["active_students_week"] >= 1
