import uuid
from datetime import date, timedelta

import pytest

from app.modules.learning.grading import grade, parse_number
from app.modules.learning.service import streak
from app.modules.learning.tasks import next_score


def attempt(problem_id: str, answer: dict, hints: int = 0, key: str | None = None) -> dict:
    return {"client_attempt_id": key or uuid.uuid4().hex, "problem_id": problem_id, "answer": answer, "time_ms": 4200, "hints_used": hints}


# ---------------------------------------------------------------- hàm thuần

@pytest.mark.parametrize("raw,expected", [("3/2", (3, 2)), ("1,5", (3, 2)), ("-0.75", (-3, 4)), ("42", (42, 1)), ("1/0", None), ("x", None), ("", None)])
def test_parse_number(raw, expected):
    v = parse_number(raw)
    assert (v.numerator, v.denominator) == expected if expected else v is None


def test_cham_bai():
    assert grade({"type": "choice", "value": "B"}, {"type": "choice", "value": "b"})
    assert grade({"type": "number", "value": "-5/4"}, {"type": "number", "value": "-1,25"})
    assert grade({"type": "set", "value": ["2", "3"]}, {"type": "set", "value": ["3", "2"]})
    assert not grade({"type": "set", "value": ["2", "3"]}, {"type": "set", "value": ["2", "3", "3"]})
    assert not grade({"type": "number", "value": "3"}, {"type": "choice", "value": "3"})


def test_chuoi_ngay_hoc():
    t = date(2026, 10, 27)
    days = {t - timedelta(days=i): 5 for i in range(1, 5)} | {t: 2}
    assert streak(days, 5, t) == 4  # hôm nay chưa đạt: giữ chuỗi từ hôm qua
    assert streak(days | {t: 5}, 5, t) == 5
    assert streak({t - timedelta(days=2): 5}, 5, t) == 0  # đứt chuỗi hôm qua


def test_diem_ky_nang_dung_nho_goi_y_cong_nua():
    assert next_score(0.5, True, 0) - 0.5 == pytest.approx(2 * (next_score(0.5, True, 2) - 0.5))
    assert next_score(0.5, False, 0) < 0.5


# ---------------------------------------------------------------- API

async def test_bai_tiep_theo_khong_lo_dap_an(client, student):
    p = (await client.get("/api/practice/next", headers=student)).json()
    assert {"id", "statement", "skill", "answer_type"} <= p.keys() and "answer" not in p
    q = (await client.get("/api/practice/next", params={"skill": "inequality"}, headers=student)).json()
    assert q["skill"]["code"] == "inequality"
    s = (await client.get("/api/practice/next", params={"similar_to": "p09"}, headers=student)).json()
    assert s["skill"]["code"] == "quadratic_equation"
    none = await client.get("/api/practice/next", params={"skill": "calculus"}, headers=student)
    assert none.status_code == 404 and none.json()["code"] == "no_problem"


async def test_khong_lap_lai_bai_vua_lam(client, student):
    ids = [(await client.get("/api/practice/next", params={"skill": "linear_equation"}, headers=student)).json()["id"] for _ in range(5)]
    assert len(set(ids)) == 5  # kỹ năng có 5 bài: 5 lần liên tiếp không trùng


async def test_nop_bai_cac_kieu_dap_an(client, student):
    cases = [
        ("p06", {"type": "choice", "value": "B"}, True),
        ("p06", {"type": "choice", "value": "A"}, False),
        ("p18", {"type": "number", "value": "-1,25"}, True),
        ("p09", {"type": "set", "value": ["3", "2"]}, True),
        ("p09", {"type": "set", "value": ["3"]}, False),
    ]
    for pid, ans, ok in cases:
        r = (await client.post("/api/attempts", json=attempt(pid, ans), headers=student)).json()
        assert r["is_correct"] is ok, (pid, ans, r)
        assert r["correct_answer_display"] and r["solution"]


async def test_nop_lai_cung_khoa_khong_tao_ban_ghi_moi(client, student):
    before = (await client.get("/api/me/progress", headers=student)).json()["total_attempts"]
    body = attempt("p03", {"type": "number", "value": "3"})
    headers = {**student, "Idempotency-Key": body["client_attempt_id"]}
    first = (await client.post("/api/attempts", json=body, headers=headers)).json()
    second = (await client.post("/api/attempts", json={**body, "answer": {"type": "number", "value": "9"}}, headers=headers)).json()
    assert first["attempt_id"] == second["attempt_id"] and second["is_correct"] is True
    assert (await client.get("/api/me/progress", headers=student)).json()["total_attempts"] == before + 1


async def test_diem_ky_nang_muc_tieu_ngay_chuoi_ngay(client):
    # Tài khoản mới để số liệu độc lập với các test khác
    r = await client.post("/api/auth/register", json={"full_name": "Phạm Thu", "email": "thu@example.com", "password": "matkhau1", "grade": 9})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    p0 = (await client.get("/api/me/progress", headers=h)).json()
    assert p0["today_attempts"] == 0 and p0["streak_days"] == 0 and p0["total_attempts"] == 0
    score0 = next(s for s in p0["skills"] if s["code"] == "factorization")["score"]

    await client.post("/api/attempts", json=attempt("p06", {"type": "choice", "value": "B"}, hints=0), headers=h)
    p1 = (await client.get("/api/me/progress", headers=h)).json()
    s1 = next(s for s in p1["skills"] if s["code"] == "factorization")
    assert s1["n_attempts"] == 1 and s1["score"] == pytest.approx(next_score(score0, True, 0))

    for _ in range(4):
        await client.post("/api/attempts", json=attempt("p07", {"type": "choice", "value": "A"}), headers=h)
    p5 = (await client.get("/api/me/progress", headers=h)).json()
    assert p5["today_attempts"] == 5 and p5["streak_days"] == 1 and p5["total_attempts"] == 5 and p5["correct_attempts"] == 5

    recent = (await client.get("/api/me/attempts", params={"limit": 3}, headers=h)).json()
    assert len(recent) == 3 and recent[0]["skill"]["code"] == "factorization" and "x^2" in recent[0]["statement"]


async def test_hoc_sinh_mau_co_chuoi_4_ngay(client, student):
    p = (await client.get("/api/me/progress", headers=student)).json()
    assert p["daily_goal"] == 5 and p["streak_days"] >= 4
    assert {s["code"] for s in p["skills"]} >= {"linear_equation", "calculus"}


async def test_du_lieu_nop_bai_sai_dinh_dang(client, student):
    r = await client.post("/api/attempts", json=attempt("p06", {"type": "matrix", "value": "B"}), headers=student)
    assert r.status_code == 422
    r = await client.post("/api/attempts", json=attempt("khong-co", {"type": "choice", "value": "B"}), headers=student)
    assert r.status_code == 404
