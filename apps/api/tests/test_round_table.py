import json
import time

from app.modules.round_table.service import points_for
from tests.test_classroom import new_student


async def room_state(code: str) -> dict:
    from app.core.redis import get_redis

    return json.loads(await get_redis().get(f"rt:room:{code}"))


async def patch_room(code: str, fn) -> None:
    from app.core.redis import get_redis

    room = await room_state(code)
    fn(room)
    await get_redis().set(f"rt:room:{code}", json.dumps(room, ensure_ascii=False))


def wrong(q: dict) -> dict:
    """Một đáp án chắc chắn sai cho câu đang hỏi."""
    if q["type"] == "choice":
        return {"type": "choice", "value": next(k for k in "ABCD" if k != q["answer"]["value"])}
    return {"type": "number", "value": "123456789"}


def test_diem_tra_loi_nhanh():
    assert points_for(False, 0, 30, 30) == 0
    assert points_for(True, 0, 30, 30) == 150 and points_for(True, 30, 30, 30) == 100 and points_for(True, 15, 30, 30) == 125


async def test_tao_phong_vao_phong_bat_dau_co_may_choi_thay(client):
    a, b, c = await new_student(client, "Chủ Bàn"), await new_student(client, "Khách Bàn"), await new_student(client, "Người Ngoài")
    r = await client.post("/api/round-table/rooms", json={"pool": "basic", "rounds": 10}, headers=a)
    assert r.status_code == 201, r.text
    room = r.json()
    code = room["code"]
    assert room["phase"] == "lobby" and len(room["players"]) == 1 and room["players"][0]["is_host"] and room["my_seat"] == 0

    joined = (await client.post(f"/api/round-table/rooms/{code.lower()}/join", json={}, headers=b)).json()
    assert joined["my_seat"] == 1 and len(joined["players"]) == 2
    assert (await client.post(f"/api/round-table/rooms/{code}/start", headers=b)).json()["code"] == "forbidden"
    assert (await client.get(f"/api/round-table/rooms/{code}", headers=c)).status_code == 404

    started = (await client.post(f"/api/round-table/rooms/{code}/start", headers=a)).json()
    assert started["phase"] == "question" and started["round"] == 1 and len(started["players"]) == 4
    assert [p["is_bot"] for p in started["players"]] == [False, False, True, True]
    q = started["question"]
    assert q["index"] == 1 and "answer" not in q and "solution" not in q
    assert (await client.post(f"/api/round-table/rooms/{code}/join", headers=c)).json()["code"] == "room_started"


async def test_dung_duoc_diem_sai_phai_quay_trung_ho_den_bi_loai(client):
    a, b = await new_student(client, "Đúng Luôn"), await new_student(client, "Sai Hoài")
    code = (await client.post("/api/round-table/rooms", json={}, headers=a)).json()["code"]
    await client.post(f"/api/round-table/rooms/{code}/join", headers=b)
    await client.post(f"/api/round-table/rooms/{code}/start", headers=a)
    # Ô hố đen của người thứ hai nằm ngay ô đầu: sai lần đầu là bị loại
    await patch_room(code, lambda room: room["players"][1].update(trap=0))
    q = (await room_state(code))["question"]

    r = await client.post(f"/api/round-table/rooms/{code}/answer", json={"round": 1, "answer": q["answer"]}, headers=a)
    assert r.status_code == 200, r.text
    assert r.json()["phase"] == "question" and r.json()["players"][0]["answered"]  # còn chờ người kia
    # Gửi lại không đổi đáp án; gửi sai lượt thì báo câu cũ
    assert (await client.post(f"/api/round-table/rooms/{code}/answer", json={"round": 1, "answer": wrong(q)}, headers=a)).status_code == 200
    assert (await client.post(f"/api/round-table/rooms/{code}/answer", json={"round": 2}, headers=b)).json()["code"] == "stale_question"

    shown = (await client.post(f"/api/round-table/rooms/{code}/answer", json={"round": 1, "answer": wrong(q)}, headers=b)).json()
    assert shown["phase"] == "reveal" and shown["reveal"]["answer_display"] and shown["reveal"]["my_answer"] == wrong(q)
    me, other = shown["players"][1], shown["players"][0]
    assert other["last"] == {"correct": True, "points": other["score"], "spun": False, "hit": False} and other["score"] >= 100
    assert me["last"] == {"correct": False, "points": 0, "spun": True, "hit": True} and not me["alive"] and me["out_round"] == 1
    assert all(p["spins"] == (0 if p["last"]["correct"] else 1) for p in shown["players"])

    # Hết giờ xem đáp án: sang câu 2, người bị loại không trả lời được nữa
    await patch_room(code, lambda room: room.update(deadline=time.time() - 1))
    nxt = (await client.get(f"/api/round-table/rooms/{code}", headers=b)).json()
    if nxt["phase"] == "question":
        assert nxt["round"] == 2 and not nxt["players"][1]["alive"]
        assert (await client.post(f"/api/round-table/rooms/{code}/answer", json={"round": 2}, headers=b)).json()["code"] == "eliminated"


async def test_het_nguoi_that_thi_ket_thuc_va_ghi_xp(client):
    a = await new_student(client, "Một Mình")
    code = (await client.post("/api/round-table/rooms", json={"pool": "thpt"}, headers=a)).json()["code"]
    await client.post(f"/api/round-table/rooms/{code}/start", headers=a)
    await patch_room(code, lambda room: room["players"][0].update(trap=0))
    q = (await room_state(code))["question"]
    await client.post(f"/api/round-table/rooms/{code}/answer", json={"round": 1, "answer": wrong(q)}, headers=a)
    await patch_room(code, lambda room: room.update(deadline=time.time() - 1))

    done = (await client.get(f"/api/round-table/rooms/{code}", headers=a)).json()
    assert done["phase"] == "finished" and done["winners"] and 0 not in done["winners"]
    assert (await room_state(code))["recorded"] is True
    rewards = (await client.get("/api/me/rewards", headers=a)).json()
    assert rewards["xp_today"] == 2 and rewards["today_attempts"] == 1  # một câu sai vẫn được 2 XP


async def test_roi_phong_cho_nhuong_chu_phong(client):
    a, b = await new_student(client, "Chủ Cũ"), await new_student(client, "Chủ Mới")
    code = (await client.post("/api/round-table/rooms", json={}, headers=a)).json()["code"]
    await client.post(f"/api/round-table/rooms/{code}/join", headers=b)
    assert (await client.post(f"/api/round-table/rooms/{code}/leave", headers=a)).status_code == 204
    room = (await client.get(f"/api/round-table/rooms/{code}", headers=b)).json()
    assert len(room["players"]) == 1 and room["players"][0]["is_host"] and room["players"][0]["is_me"]
    await client.post(f"/api/round-table/rooms/{code}/leave", headers=b)
    assert (await client.get(f"/api/round-table/rooms/{code}", headers=b)).status_code == 404
