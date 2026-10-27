from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.modules.classroom.service import CODE_ALPHABET, normalize_code
from tests.test_exams import answers_of


async def new_student(client, name: str) -> dict[str, str]:
    email = f"{normalize_code(name).lower()}{datetime.now().timestamp():.0f}@example.com"
    r = await client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "matkhau1", "grade": 10})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def new_class(client, teacher, name="10A1 · Toán") -> dict:
    r = await client.post("/api/classes", json={"name": name, "grade": 10}, headers=teacher)
    assert r.status_code == 201, r.text
    return r.json()


async def test_tao_lop_va_vao_lop_bang_ma(client, teacher, student):
    c = await new_class(client, teacher)
    assert len(c["join_code"]) == 6 and set(c["join_code"]) <= set(CODE_ALPHABET) and c["member_count"] == 0
    # Học sinh gõ mã chữ thường, có khoảng trắng / gạch ngang vẫn vào được; vào hai lần không bị nhân đôi
    code = f" {c['join_code'][:3].lower()}-{c['join_code'][3:]} "
    for _ in range(2):
        r = await client.post("/api/classes/join", json={"code": code}, headers=student)
        assert r.status_code == 200, r.text
    joined = r.json()
    assert joined["id"] == c["id"] and joined["member_count"] == 1 and "join_code" not in joined
    assert joined["teacher_name"]

    detail = (await client.get(f"/api/classes/{c['id']}", headers=teacher)).json()
    assert [m["email"] for m in detail["members"]] == ["hs@mathgen.vn"]
    # Học sinh xem lớp: không thấy mã lớp và danh sách email
    seen = (await client.get(f"/api/classes/{c['id']}", headers=student)).json()
    assert "members" not in seen and "join_code" not in seen

    assert (await client.post("/api/classes/join", json={"code": "ZZZZZZ"}, headers=student)).json()["code"] == "class_not_found"
    assert (await client.post("/api/classes/join", json={"code": c["join_code"]}, headers=teacher)).status_code == 403
    assert (await client.post("/api/classes", json={"name": "Lớp lạ"}, headers=student)).status_code == 403

    # Đổi mã: mã cũ hết hiệu lực
    fresh = (await client.post(f"/api/classes/{c['id']}/code", headers=teacher)).json()
    assert fresh["join_code"] != c["join_code"]
    other = await new_student(client, "Trần Mai")
    assert (await client.post("/api/classes/join", json={"code": c["join_code"]}, headers=other)).status_code == 404
    assert (await client.get(f"/api/classes/{c['id']}", headers=other)).status_code == 404  # người ngoài lớp


async def test_giao_bai_lam_bai_va_bao_cao(client, teacher, student):
    c = await new_class(client, teacher)
    s2 = await new_student(client, "Phạm Minh Anh")
    s3 = await new_student(client, "Đỗ Quang Huy")
    for s in (student, s2, s3):
        await client.post("/api/classes/join", json={"code": c["join_code"]}, headers=s)

    due = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    r = await client.post(f"/api/classes/{c['id']}/assignments",
                          json={"mode": "written", "size": 5, "duration_minutes": 20, "due_at": due, "shuffle": True}, headers=teacher)
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["title"] == "Bài tập tự luận · 5 câu" and a["member_count"] == 3 and a["submitted_count"] == 0

    mine = (await client.get("/api/me/assignments", headers=s2)).json()
    assert mine[0]["id"] == a["id"] and mine[0]["status"] == "todo" and mine[0]["class_name"] == c["name"]
    assert next(x for x in (await client.get("/api/classes", headers=s2)).json() if x["id"] == c["id"])["pending_count"] == 1

    # Bắt đầu hai lần vẫn là một đề; mọi học sinh cùng bộ câu hỏi (có thể khác thứ tự)
    e1 = (await client.post(f"/api/assignments/{a['id']}/start", headers=student)).json()["exam_id"]
    assert (await client.post(f"/api/assignments/{a['id']}/start", headers=student)).json()["exam_id"] == e1
    e2 = (await client.post(f"/api/assignments/{a['id']}/start", headers=s2)).json()["exam_id"]
    x1 = (await client.get(f"/api/exams/{e1}", headers=student)).json()
    x2 = (await client.get(f"/api/exams/{e2}", headers=s2)).json()
    assert x1["assignment_id"] == a["id"] and x1["ends_at"] and x1["title"] == a["title"]
    assert sorted(q["statement"] for q in x1["questions"]) == sorted(q["statement"] for q in x2["questions"])
    assert (await client.get("/api/me/assignments", headers=student)).json()[0]["status"] == "in_progress"

    # hs@mathgen.vn làm đúng hết; Minh Anh làm đúng 2 câu; Quang Huy chưa làm
    full = await answers_of(e1)
    await client.post(f"/api/exams/{e1}/submit", json={"answers": full}, headers=student)
    two = dict(list((await answers_of(e2)).items())[:2])
    await client.post(f"/api/exams/{e2}/submit", json={"answers": two}, headers=s2)
    done = (await client.get(f"/api/exams/{e1}", headers=student)).json()
    assert done["answers"] == full  # sau khi nộp, đề trả lại bài làm để xem lại trên máy khác

    rep = (await client.get(f"/api/assignments/{a['id']}/report", headers=teacher)).json()
    sm = rep["summary"]
    assert (sm["member_count"], sm["submitted_count"], sm["average_score"], sm["max_score"], sm["min_score"]) == (3, 2, 7.0, 10.0, 4.0)
    assert sm["distribution"] == [0, 0, 1, 0, 1]
    assert [s["status"] for s in rep["students"]] == ["submitted", "submitted", "todo"]
    assert rep["students"][0]["score"] == 10 and rep["students"][0]["duration_seconds"] is not None
    # Câu nào cũng có 2 bài nộp; tổng tỉ lệ đúng = (5 + 2) / 2 câu-bài trên 5 câu
    assert [q["answered"] for q in rep["questions"]] == [2] * 5
    assert abs(sum(q["correct_rate"] for q in rep["questions"]) - 3.5) < 1e-9
    assert rep["skills"] and all(0 <= s["correct_rate"] <= 1 for s in rep["skills"])

    sub = (await client.get(f"/api/assignments/{a['id']}/submissions/{rep['students'][1]['id']}", headers=teacher)).json()
    assert sub["result"]["correct"] == 2 and sub["answers"] == two
    assert (await client.get(f"/api/assignments/{a['id']}/report", headers=student)).status_code == 403

    listed = (await client.get(f"/api/classes/{c['id']}/assignments", headers=teacher)).json()
    assert listed[0]["submitted_count"] == 2 and listed[0]["average_score"] == 7.0

    board = (await client.get(f"/api/classes/{c['id']}/leaderboard", headers=s2)).json()
    assert [r["average_score"] for r in board] == [10.0, 4.0, None]
    assert [r["is_me"] for r in board] == [False, True, False] and board[0]["week_problems"] >= 5


async def test_de_thi_thpt_va_han_nop(client, teacher, student):
    c = await new_class(client, teacher)
    await client.post("/api/classes/join", json={"code": c["join_code"]}, headers=student)
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    r = await client.post(f"/api/classes/{c['id']}/assignments", json={"kind": "official", "due_at": past}, headers=teacher)
    assert r.status_code == 422 and r.json()["code"] == "due_in_past"
    soon = (datetime.now(UTC) + timedelta(minutes=30)).isoformat()
    a = (await client.post(f"/api/classes/{c['id']}/assignments", json={"kind": "official", "due_at": soon}, headers=teacher)).json()
    assert a["kind"] == "official" and a["size"] == 22 and a["duration_minutes"] == 90
    exam_id = (await client.post(f"/api/assignments/{a['id']}/start", headers=student)).json()["exam_id"]
    exam = (await client.get(f"/api/exams/{exam_id}", headers=student)).json()
    # Bắt đầu sát hạn: đồng hồ chỉ chạy đến hạn nộp, không đủ 90 phút
    ends = datetime.fromisoformat(exam["ends_at"])
    assert ends <= datetime.fromisoformat(soon) + timedelta(seconds=1)

    # Bài đã quá hạn: chưa bắt đầu thì không mở được, hiện là "quá hạn"
    b = (await client.post(f"/api/classes/{c['id']}/assignments", json={"mode": "choice", "size": 10, "due_at": soon}, headers=teacher)).json()
    from app.core.db import SessionLocal
    from app.modules.classroom.models import Assignment

    async with SessionLocal() as db:
        await db.execute(update(Assignment).where(Assignment.id == b["id"]).values(due_at=datetime.now(UTC) - timedelta(hours=1)))
        await db.commit()
    assert (await client.post(f"/api/assignments/{b['id']}/start", headers=student)).json()["code"] == "assignment_closed"
    status = {x["id"]: x["status"] for x in (await client.get(f"/api/classes/{c['id']}/assignments", headers=student)).json()}
    assert status == {a["id"]: "in_progress", b["id"]: "missed"}


async def test_roi_lop_xoa_bai_giao_va_xoa_lop(client, teacher, student):
    c = await new_class(client, teacher)
    s2 = await new_student(client, "Ngô Thu Hà")
    for s in (student, s2):
        await client.post("/api/classes/join", json={"code": c["join_code"]}, headers=s)
    a = (await client.post(f"/api/classes/{c['id']}/assignments", json={"mode": "choice", "size": 10}, headers=teacher)).json()
    exam_id = (await client.post(f"/api/assignments/{a['id']}/start", headers=s2)).json()["exam_id"]

    me = (await client.get("/api/me", headers=s2)).json()["id"]
    hs = (await client.get("/api/me", headers=student)).json()["id"]
    # Học sinh không xóa được bạn khác; tự rời lớp được
    assert (await client.delete(f"/api/classes/{c['id']}/members/{hs}", headers=s2)).status_code == 404
    assert (await client.delete(f"/api/classes/{c['id']}/members/{me}", headers=s2)).status_code == 204
    assert (await client.get(f"/api/classes/{c['id']}", headers=s2)).status_code == 404
    assert (await client.post(f"/api/assignments/{a['id']}/start", headers=s2)).status_code == 404
    # Giáo viên xóa học sinh khỏi lớp
    assert (await client.delete(f"/api/classes/{c['id']}/members/{hs}", headers=teacher)).status_code == 204
    assert (await client.get(f"/api/classes/{c['id']}", headers=teacher)).json()["member_count"] == 0

    # Xóa bài giao / xóa lớp: đề học sinh đã làm vẫn còn trong lịch sử
    assert (await client.delete(f"/api/assignments/{a['id']}", headers=teacher)).status_code == 204
    kept = (await client.get(f"/api/exams/{exam_id}", headers=s2)).json()
    assert kept["id"] == exam_id and kept["assignment_id"] is None
    assert (await client.delete(f"/api/classes/{c['id']}", headers=student)).status_code == 403
    assert (await client.delete(f"/api/classes/{c['id']}", headers=teacher)).status_code == 204
    assert (await client.get(f"/api/classes/{c['id']}", headers=teacher)).status_code == 404
    assert all(x["id"] != c["id"] for x in (await client.get("/api/classes", headers=teacher)).json())


async def test_lop_khong_co_thanh_vien(client, teacher):
    c = await new_class(client, teacher, "Lớp trống")
    assert (await client.get(f"/api/classes/{c['id']}/leaderboard", headers=teacher)).json() == []
    a = (await client.post(f"/api/classes/{c['id']}/assignments", json={"mode": "written", "size": 5}, headers=teacher)).json()
    rep = (await client.get(f"/api/assignments/{a['id']}/report", headers=teacher)).json()
    assert rep["summary"]["average_score"] is None and rep["students"] == [] and all(q["correct_rate"] is None for q in rep["questions"])
