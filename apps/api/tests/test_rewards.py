from datetime import date, timedelta

from sqlalchemy import select

from app.modules.learning.models import DailyActivity, RewardProfile
from app.modules.learning.rewards import QUEST_TIERS, daily_quests, longest_run, pending_freezes, streak
from app.modules.learning.service import today_vn
from tests.test_classroom import new_student
from tests.test_learning import attempt

RIGHT = ("p07", {"type": "choice", "value": "A"})
WRONG = ("p06", {"type": "choice", "value": "A"})


async def answer(client, h, ok: bool) -> dict:
    pid, ans = RIGHT if ok else WRONG
    r = await client.post("/api/attempts", json=attempt(pid, ans), headers=h)
    assert r.status_code == 200, r.text
    return r.json()


async def user_id(client, h) -> str:
    return (await client.get("/api/me", headers=h)).json()["id"]


async def set_days(uid: str, days: dict[int, int], freezes: int | None = None) -> None:
    """Ghi sẵn số bài của những ngày trước (khóa: số ngày trước hôm nay)."""
    from app.core.db import SessionLocal

    async with SessionLocal() as db:
        for ago, n in days.items():
            db.add(DailyActivity(user_id=uid, day=today_vn() - timedelta(days=ago), count=n))
        if freezes is not None:
            db.add(RewardProfile(user_id=uid, xp=0, correct=0, freezes=freezes, longest_streak=0))
        await db.commit()


# ---------------------------------------------------------------- hàm thuần

def test_nhiem_vu_co_dinh_trong_ngay_moi_muc_mot_cai():
    d = date(2026, 10, 27)
    qs = daily_quests("u1", d)
    assert qs == daily_quests("u1", d) and [q in tier for q, tier in zip(qs, QUEST_TIERS)] == [True] * 3
    # Khác ngày hoặc khác học sinh thì đổi bộ nhiệm vụ (ít nhất ở vài ngày)
    assert any(daily_quests("u1", d + timedelta(days=i)) != qs for i in range(1, 10))


def test_chuoi_ngay_co_dong_bang():
    t = date(2026, 10, 27)
    met = {t - timedelta(days=i): 5 for i in (2, 3, 4)}  # nghỉ hôm qua
    assert streak(met, 5, t) == 0
    assert pending_freezes(met, 5, t, (), 1) == [t - timedelta(days=1)]
    assert streak(met, 5, t, spare=1) == 3  # ngày đóng băng nối chuỗi nhưng không cộng ngày
    assert streak(met | {t: 5}, 5, t, frozen={t - timedelta(days=1)}) == 4
    # Nghỉ 2 ngày mà chỉ còn 1 lượt: không dùng lượt nào, mất chuỗi
    gap2 = {t - timedelta(days=i): 5 for i in (3, 4)}
    assert pending_freezes(gap2, 5, t, (), 1) == [] and streak(gap2, 5, t, spare=1) == 0
    assert pending_freezes(gap2, 5, t, (), 2) == [t - timedelta(days=1), t - timedelta(days=2)]
    # Chưa từng học thì không có gì để giữ
    assert pending_freezes({}, 5, t, (), 2) == []
    assert longest_run([True, True, False, True, True, True]) == 3


# ---------------------------------------------------------------- API

async def test_xp_muc_tieu_ngay_nhiem_vu_huy_hieu(client):
    h = await new_student(client, "Lê Minh XP")
    r0 = (await client.get("/api/me/rewards", headers=h)).json()
    assert r0["xp_total"] == 0 and r0["streak_days"] == 0 and r0["freezes"] == 1 and len(r0["quests"]) == 3
    assert len(r0["calendar"]) == 35 and r0["calendar"][-1]["day"] == r0["today"] and not any(b["earned_at"] for b in r0["badges"])

    first = await answer(client, h, True)
    assert first["xp_gained"] >= 10
    assert (await answer(client, h, False))["xp_gained"] == 2  # làm sai vẫn có chút XP
    for _ in range(3):
        await answer(client, h, True)

    r = (await client.get("/api/me/rewards", headers=h)).json()
    # 4 đúng · 1 sai · thưởng đạt mục tiêu ngày, cộng thưởng các nhiệm vụ đã xong
    quest_xp = sum(q["reward"] for q in r["quests"] if q["done"])
    assert r["xp_today"] == r["xp_total"] == 4 * 10 + 2 + 20 + quest_xp
    assert r["streak_days"] == 1 and r["today_attempts"] == 5 and r["calendar"][-1]["status"] == "met"
    earned = {b["code"] for b in r["badges"] if b["earned_at"]}
    assert "first_correct" in earned and "streak_7" not in earned
    for q in r["quests"]:
        assert 0 <= q["progress"] <= q["target"] and q["done"] == (q["progress"] >= q["target"])
    # Tiến độ dùng cùng cách tính chuỗi
    assert (await client.get("/api/me/progress", headers=h)).json()["streak_days"] == 1


async def test_dong_bang_giu_chuoi_khi_nghi_mot_ngay(client):
    h = await new_student(client, "Trần Nghỉ Một")
    uid = await user_id(client, h)
    await set_days(uid, {2: 5, 3: 5, 4: 5})  # nghỉ hôm qua, còn 1 lượt mặc định

    r = (await client.get("/api/me/rewards", headers=h)).json()
    assert r["streak_days"] == 3 and r["freezes"] == 0 and r["calendar"][-2]["status"] == "frozen"
    assert (await client.get("/api/me/progress", headers=h)).json()["streak_days"] == 3

    for _ in range(5):  # học lại hôm nay: chốt ngày đóng băng, chuỗi nối tiếp
        await answer(client, h, True)
    r = (await client.get("/api/me/rewards", headers=h)).json()
    assert r["streak_days"] == 4 and r["freezes"] == 0 and r["longest_streak"] == 4
    from app.core.db import SessionLocal

    async with SessionLocal() as db:
        y = await db.get(DailyActivity, (uid, today_vn() - timedelta(days=1)))
        assert y.frozen and y.count == 0
        assert (await db.scalar(select(RewardProfile.freezes).where(RewardProfile.user_id == uid))) == 0


async def test_nghi_qua_so_luot_thi_mat_chuoi_khong_mat_luot(client):
    h = await new_student(client, "Võ Nghỉ Hai")
    await set_days(await user_id(client, h), {3: 5, 4: 5})
    r = (await client.get("/api/me/rewards", headers=h)).json()
    assert r["streak_days"] == 0 and r["freezes"] == 1
    await answer(client, h, True)
    assert (await client.get("/api/me/rewards", headers=h)).json()["freezes"] == 1


async def test_du_7_ngay_duoc_them_luot_dong_bang_va_huy_hieu(client):
    h = await new_student(client, "Đỗ Bảy Ngày")
    await set_days(await user_id(client, h), {i: 5 for i in range(1, 7)})
    for _ in range(5):
        last = await answer(client, h, True)
    assert last["xp_gained"] >= 10 + 20
    r = (await client.get("/api/me/rewards", headers=h)).json()
    assert r["streak_days"] == 7 and r["freezes"] == 2
    assert "streak_7" in {b["code"] for b in r["badges"] if b["earned_at"]}


async def test_de_va_dau_truong_cong_xp_va_bo_dem(client):
    h = await new_student(client, "Phan Đấu Sĩ")
    run = (await client.post("/api/arena/runs", json={"pool": "basic", "duration_minutes": 5}, headers=h)).json()
    await client.post(f"/api/arena/runs/{run['id']}/answer", json={"key": run["question"]["id"], "answer": {"type": "number", "value": "0"}}, headers=h)
    await client.post(f"/api/arena/runs/{run['id']}/finish", headers=h)

    exam = (await client.post("/api/exams", json={"mode": "choice", "size": 10}, headers=h)).json()
    q = exam["questions"][0]
    r = await client.post(f"/api/exams/{exam['id']}/submit", json={"answers": {q["id"]: {"type": "choice", "value": "A"}}}, headers=h)
    assert r.status_code == 200, r.text

    from app.core.db import SessionLocal

    async with SessionLocal() as db:
        row = await db.get(DailyActivity, (await user_id(client, h), today_vn()))
        assert row.arena_runs == 1 and row.exams == 1 and row.count == 2 and row.xp >= 2 * row.count
    r = (await client.get("/api/me/rewards", headers=h)).json()
    assert "first_arena" in {b["code"] for b in r["badges"] if b["earned_at"]}
