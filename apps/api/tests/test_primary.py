from datetime import datetime

from app.modules.exams.generator import PRIMARY, Rng
from app.modules.learning.grading import grade


async def student(client, name: str, g: int) -> dict[str, str]:
    email = f"tieuhoc{g}{datetime.now().timestamp():.0f}{len(name)}@example.com"
    r = await client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "matkhau1", "grade": g})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_dang_bai_tieu_hoc_sinh_dung():
    assert len(PRIMARY) == 20 and {t.grade for t in PRIMARY} == {1, 2, 3, 4, 5}
    g = Rng(7)
    for t in PRIMARY:
        for _ in range(50):
            q = t.make(g)
            a = q["answer"]
            if a["type"] == "choice":
                keys = [c["key"] for c in q["choices"]]
                assert a["value"] in keys and len(keys) >= 3 and len({c["content"] for c in q["choices"]}) == len(keys), (t.code, q)
            else:
                assert grade(a, {"type": "number", "value": a["value"].replace(".", ",")}), (t.code, q)


async def test_hoc_sinh_lop_1_den_5_chi_gap_noi_dung_tieu_hoc(client):
    h = await student(client, "Bé Na", 3)
    skills = (await client.get("/api/me/progress", headers=h)).json()["skills"]
    assert skills and all(s["code"].startswith("p_") for s in skills)
    for _ in range(6):
        p = (await client.get("/api/practice/next", headers=h)).json()
        assert p["skill"]["code"].startswith("p_") and p["grade"] <= 5, p

    exam = (await client.post("/api/exams", json={"mode": "choice", "size": 10}, headers=h)).json()
    assert all(q["grade"] <= 5 for q in exam["questions"]), [q["template"]["code"] for q in exam["questions"]]
    run = await client.post("/api/arena/runs", json={"pool": "primary", "duration_minutes": 5}, headers=h)
    assert run.status_code == 201 and run.json()["question"]["grade"] <= 5


async def test_hoc_sinh_lop_9_khong_gap_bai_tieu_hoc(client, student):
    for _ in range(8):
        p = (await client.get("/api/practice/next", headers=student)).json()
        assert not p["skill"]["code"].startswith("p_"), p
    exam = (await client.post("/api/exams", json={"mode": "written", "size": 10}, headers=student)).json()
    assert all(q["grade"] >= 6 for q in exam["questions"])
    assert not any(s["code"].startswith("p_") for s in (await client.get("/api/me/progress", headers=student)).json()["skills"])


async def test_lop_2_khong_gap_bai_qua_lop_3(client):
    h = await student(client, "Bé Lớp Hai", 2)
    for _ in range(10):
        p = (await client.get("/api/practice/next", headers=h)).json()
        assert p["grade"] <= 3, p
    for mode in ("choice", "written"):
        exam = (await client.post("/api/exams", json={"mode": mode, "size": 20}, headers=h)).json()
        assert all(q["grade"] <= 3 for q in exam["questions"]), [q["template"]["code"] for q in exam["questions"]]
