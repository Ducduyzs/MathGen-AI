from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.modules.arena.models import ArenaRun
from app.modules.arena.service import points_for
from tests.test_classroom import new_student


async def current_answer(run_id: str) -> dict:
    from app.core.db import SessionLocal

    async with SessionLocal() as db:
        return (await db.get(ArenaRun, run_id)).current["answer"]


async def expire(run_id: str) -> None:
    from app.core.db import SessionLocal

    async with SessionLocal() as db:
        await db.execute(update(ArenaRun).where(ArenaRun.id == run_id).values(ends_at=datetime.now(UTC) - timedelta(minutes=1)))
        await db.commit()


async def play(client, user, run: dict, pattern: list[bool]) -> dict:
    for ok in pattern:
        q = run["question"]
        given = await current_answer(run["id"]) if ok else None
        r = await client.post(f"/api/arena/runs/{run['id']}/answer", json={"key": q["id"], "answer": given}, headers=user)
        assert r.status_code == 200, r.text
        assert r.json()["is_correct"] is ok
        run = r.json()["run"]
    return run


async def test_luot_dau_tinh_diem_chuoi_dung(client, student):
    r = await client.post("/api/arena/runs", json={"pool": "basic", "duration_minutes": 5}, headers=student)
    assert r.status_code == 201, r.text
    run = r.json()
    q = run["question"]
    assert not run["finished"] and run["score"] == 0 and q["index"] == 1
    assert q["type"] in ("choice", "number") and not {"answer", "answer_display", "solution"} & q.keys()

    # Đúng 3 câu liên tiếp: điểm thưởng tăng theo chuỗi; bỏ qua làm mất chuỗi nhưng không trừ điểm
    run = await play(client, student, run, [True, True, True, False, True])
    assert run["answered"] == 5 and run["correct"] == 4 and run["combo"] == 1 and run["best_combo"] == 3
    assert run["question"]["index"] == 6
    # Gửi lại câu đã chấm (bấm hai lần): báo câu cũ, không chấm lại
    r = await client.post(f"/api/arena/runs/{run['id']}/answer", json={"key": "cu", "answer": None}, headers=student)
    assert r.json()["code"] == "stale_question"

    done = (await client.post(f"/api/arena/runs/{run['id']}/finish", headers=student)).json()
    assert done["finished"] and "question" not in done and len(done["history"]) == 5
    assert [h["is_correct"] for h in done["history"]] == [True, True, True, False, True]
    assert done["history"][3]["points"] == 0 and done["history"][3].get("given") is None
    assert done["score"] == sum(h["points"] for h in done["history"]) and done["personal_best"] is True and done["week_rank"] >= 1
    # Kết thúc rồi thì không trả lời thêm được; kết thúc lại vẫn an toàn
    assert (await client.post(f"/api/arena/runs/{run['id']}/answer", json={"key": "x"}, headers=student)).json()["code"] == "run_over"
    assert (await client.post(f"/api/arena/runs/{run['id']}/finish", headers=student)).json()["score"] == done["score"]

    me = (await client.get("/api/arena/me", headers=student)).json()
    assert me["recent"][0]["id"] == run["id"] and me["active_run_id"] is None
    assert {"pool": "basic", "duration_minutes": 5, "score": done["score"]} in me["best"]


def test_diem_thuong_chuoi_co_tran():
    assert points_for(0.3, 0) == 13 and points_for(0.3, 2) == 17
    assert points_for(0.3, 5) == points_for(0.3, 9) == 23


async def test_het_gio_server_chot_luot(client):
    hs = await new_student(client, "Lý Thu Hà")
    run = (await client.post("/api/arena/runs", json={"pool": "thpt", "duration_minutes": 15}, headers=hs)).json()
    run = await play(client, hs, run, [True])
    assert (await client.get("/api/arena/me", headers=hs)).json()["active_run_id"] == run["id"]
    await expire(run["id"])
    late = await client.post(f"/api/arena/runs/{run['id']}/answer", json={"key": run["question"]["id"], "answer": None}, headers=hs)
    assert late.status_code == 409 and late.json()["code"] == "run_over"
    got = (await client.get(f"/api/arena/runs/{run['id']}", headers=hs)).json()
    assert got["finished"] and got["answered"] == 1
    # Lượt của người khác: 404
    other = await new_student(client, "Mai Phương")
    assert (await client.get(f"/api/arena/runs/{run['id']}", headers=other)).status_code == 404


async def test_bat_dau_luot_moi_ket_thuc_luot_cu_va_bang_xep_hang(client):
    a = await new_student(client, "An Bình")
    b = await new_student(client, "Bảo Ngọc")
    first = (await client.post("/api/arena/runs", json={"duration_minutes": 30}, headers=a)).json()
    first = await play(client, a, first, [True, True])
    second = (await client.post("/api/arena/runs", json={"duration_minutes": 30}, headers=a)).json()
    assert (await client.get(f"/api/arena/runs/{first['id']}", headers=a)).json()["finished"]
    await play(client, a, second, [True])
    await client.post(f"/api/arena/runs/{second['id']}/finish", headers=a)

    run_b = (await client.post("/api/arena/runs", json={"duration_minutes": 30}, headers=b)).json()
    run_b = await play(client, b, run_b, [True, True, True, True])
    await client.post(f"/api/arena/runs/{run_b['id']}/finish", headers=b)

    board = (await client.get("/api/arena/leaderboard?pool=basic&duration=30&scope=week", headers=a)).json()
    rows = {r["full_name"]: r for r in board["rows"]}
    # Mỗi người chỉ một dòng (lượt cao nhất); B làm đúng nhiều hơn nên đứng trên
    assert rows["Bảo Ngọc"]["rank"] < rows["An Bình"]["rank"] and rows["An Bình"]["is_me"] and board["me"] is None
    assert rows["An Bình"]["score"] == first["score"]
    assert sum(r["full_name"] == "An Bình" for r in board["rows"]) == 1
    assert (await client.get("/api/arena/leaderboard?duration=7", headers=a)).status_code == 422


def test_bac_rank_va_diem_cong_tru():
    from app.modules.arena.ranks import describe, rank_delta

    assert describe(0).label == "Đồng III" and describe(0).next_at == 133
    assert describe(450).label == "Bạc III" and describe(899).label == "Bạc I" and describe(899).next_at == 900
    assert describe(3500).label == "Cao thủ" and describe(3500).next_at is None
    assert rank_delta(0, 500, 2, 5) is None  # dưới 3 câu: không tính rank
    assert rank_delta(0, 300, 10, 5) == 40  # 60 điểm/phút ở bậc Đồng: tăng tối đa
    assert rank_delta(3000, 100, 5, 5) == -25  # Cao thủ chơi kém: trừ tối đa
    assert rank_delta(0, 900, 30, 30) > rank_delta(0, 150, 10, 5) > 0  # cùng 30 điểm/phút: lượt dài nặng hơn


async def test_luot_tinh_rank_va_bang_rank(client):
    h = await new_student(client, "Leo Rank")
    me0 = (await client.get("/api/arena/me", headers=h)).json()
    assert me0["rank"]["label"] == "Đồng III" and me0["rank"]["points"] == 0 and me0["rank"]["ranked_runs"] == 0

    run = (await client.post("/api/arena/runs", json={"pool": "basic", "duration_minutes": 5}, headers=h)).json()
    run = await play(client, h, run, [True, True, True, True])
    done = (await client.post(f"/api/arena/runs/{run['id']}/finish", headers=h)).json()
    change = done["rank_change"]
    assert change["before"]["points"] == 0 and change["after"]["points"] == max(0, change["delta"]) and change["after"]["ranked_runs"] == 1

    me = (await client.get("/api/arena/me", headers=h)).json()
    assert me["rank"]["points"] == change["after"]["points"]
    board = (await client.get("/api/arena/ranking", headers=h)).json()
    mine = next((r for r in board["rows"] if r["is_me"]), board["me"])
    assert mine and mine["rating"]["points"] == me["rank"]["points"] and mine["rank"] >= 1

    # Lượt quá ít câu: không đổi rank
    short = (await client.post("/api/arena/runs", json={"pool": "basic", "duration_minutes": 5}, headers=h)).json()
    short = await play(client, h, short, [True])
    assert "rank_change" not in (await client.post(f"/api/arena/runs/{short['id']}/finish", headers=h)).json()
    assert (await client.get("/api/arena/me", headers=h)).json()["rank"]["points"] == me["rank"]["points"]
