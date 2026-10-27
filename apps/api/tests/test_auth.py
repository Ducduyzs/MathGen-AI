async def test_login_sai_mat_khau(client):
    r = await client.post("/api/auth/login", json={"email": "hs@mathgen.vn", "password": "sai-mat-khau"})
    assert r.status_code == 401 and r.json() == {"code": "invalid_credentials"}


async def test_dang_ky_refresh_dang_xuat(client):
    r = await client.post("/api/auth/register", json={"full_name": "Lê Văn Bình", "email": "Binh@Example.com", "password": "matkhau1", "grade": 8})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"] == {"id": body["user"]["id"], "email": "binh@example.com", "full_name": "Lê Văn Bình", "role": "student", "grade": 8}
    assert "refresh_token" in r.cookies and "httponly" in r.headers["set-cookie"].lower()

    me = await client.get("/api/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["email"] == "binh@example.com"

    # Refresh bằng cookie httpOnly (trình duyệt tự gửi kèm)
    rf = await client.post("/api/auth/refresh")
    assert rf.status_code == 200
    me2 = await client.get("/api/me", headers={"Authorization": f"Bearer {rf.json()['access_token']}"})
    assert me2.status_code == 200

    # Đăng xuất thu hồi refresh token: dùng lại token cũ phải bị từ chối
    old = client.cookies.get("refresh_token")
    assert (await client.post("/api/auth/logout")).status_code == 204
    client.cookies.set("refresh_token", old, domain="api.test")
    assert (await client.post("/api/auth/refresh")).status_code == 401


async def test_dang_ky_trung_email_va_du_lieu_sai(client):
    r = await client.post("/api/auth/register", json={"full_name": "Ai Đó", "email": "hs@mathgen.vn", "password": "matkhau1", "grade": 9})
    assert r.status_code == 409 and r.json()["code"] == "email_taken"
    r = await client.post("/api/auth/register", json={"full_name": "Ai Đó", "email": "moi@example.com", "password": "123", "grade": 9})
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


async def test_can_token_hop_le(client):
    assert (await client.get("/api/me")).status_code == 401
    assert (await client.get("/api/me", headers={"Authorization": "Bearer token-gia"})).json() == {"code": "unauthorized"}
    assert (await client.post("/api/auth/refresh")).status_code == 401
