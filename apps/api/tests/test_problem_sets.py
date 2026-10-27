from tests.test_classroom import new_class, new_student
from tests.test_exams import answers_of


async def new_set(client, teacher, items=None, title="Bộ đề hàm số tuần 5") -> dict:
    r = await client.post("/api/problem-sets", json={"title": title, "items": items or []}, headers=teacher)
    assert r.status_code == 201, r.text
    return r.json()


async def test_soan_bo_de_doi_so_lieu_sap_xep(client, teacher, student):
    s = await new_set(client, teacher, [{"template": "lin_eq_choice", "count": 2}, {"template": "thpt_monotonic", "count": 1}])
    assert s["size"] == 3 and s["counts"] == {"choice": 3, "true_false": 0, "number": 0}
    keys = [q["key"] for q in s["questions"]]
    assert len(set(keys)) == 3 and all(q["answer_display"] and q["solution"] for q in s["questions"])
    assert [q["template"]["code"] for q in s["questions"]] == ["lin_eq_choice", "lin_eq_choice", "thpt_monotonic"]
    assert s["questions"][0]["statement"] != s["questions"][1]["statement"]  # cùng dạng nhưng khác số liệu

    # Thêm câu Đúng/Sai và câu điền số
    templates = (await client.get("/api/exams/templates", headers=teacher)).json()
    tf = next(t["code"] for t in templates if t["type"] == "true_false")
    num = next(t["code"] for t in templates if t["type"] == "number")
    r = await client.post(f"/api/problem-sets/{s['id']}/questions",
                          json={"items": [{"template": tf}, {"template": num, "count": 2}]}, headers=teacher)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["size"] == 6 and s["counts"] == {"choice": 3, "true_false": 1, "number": 2}

    # Đổi số liệu câu 2: giữ vị trí và dạng bài, đổi mã câu
    old = s["questions"][1]
    s = (await client.post(f"/api/problem-sets/{s['id']}/questions/{old['key']}/regenerate", headers=teacher)).json()
    new = s["questions"][1]
    assert new["key"] != old["key"] and new["template"] == old["template"] and s["size"] == 6

    # Sắp xếp lại + xóa câu đầu (không có trong thứ tự mới), đổi tên và mô tả
    order = [q["key"] for q in reversed(s["questions"][1:])]
    r = await client.patch(f"/api/problem-sets/{s['id']}", json={"order": order, "title": "Bộ đề tuần 6", "description": "Ôn tập"},
                           headers=teacher)
    assert r.status_code == 200, r.text
    s = r.json()
    assert [q["key"] for q in s["questions"]] == order and s["title"] == "Bộ đề tuần 6" and s["description"] == "Ôn tập"
    assert (await client.patch(f"/api/problem-sets/{s['id']}", json={"order": [*order, "khongco"]}, headers=teacher)).status_code == 422
    assert (await client.patch(f"/api/problem-sets/{s['id']}", json={"order": [order[0], order[0]]}, headers=teacher)).status_code == 422
    cleared = (await client.patch(f"/api/problem-sets/{s['id']}", json={"description": None}, headers=teacher)).json()
    assert cleared["description"] is None and cleared["title"] == "Bộ đề tuần 6"

    listed = (await client.get("/api/problem-sets", headers=teacher)).json()
    assert listed[0]["id"] == s["id"] and "questions" not in listed[0] and listed[0]["size"] == 5

    # Chỉ giáo viên sở hữu mới xem / sửa được
    assert (await client.get("/api/problem-sets", headers=student)).status_code == 403
    assert (await client.get(f"/api/problem-sets/{s['id']}", headers=student)).status_code == 403
    assert (await client.post(f"/api/problem-sets/{s['id']}/questions", json={"items": [{"template": "khong_co"}]},
                              headers=teacher)).json()["code"] == "no_template"
    big = (await client.post(f"/api/problem-sets/{s['id']}/questions", json={"items": [{"template": "lin_eq_choice", "count": 20}] * 5},
                             headers=teacher))
    assert big.json()["code"] == "set_too_large"

    copy = (await client.post(f"/api/problem-sets/{s['id']}/duplicate", headers=teacher)).json()
    assert copy["id"] != s["id"] and copy["size"] == 5 and copy["title"].endswith("(bản sao)")
    assert (await client.delete(f"/api/problem-sets/{copy['id']}", headers=teacher)).status_code == 204
    assert (await client.get(f"/api/problem-sets/{copy['id']}", headers=teacher)).status_code == 404


async def test_giao_bo_de_cho_lop(client, teacher):
    s = await new_set(client, teacher, [{"template": "lin_eq_choice", "count": 3}, {"template": "func_value_choice", "count": 2}],
                      title="Kiểm tra 15 phút")
    c = await new_class(client, teacher)
    hs = await new_student(client, "Ngô Bảo Châu")
    await client.post("/api/classes/join", json={"code": c["join_code"]}, headers=hs)

    r = await client.post(f"/api/classes/{c['id']}/assignments",
                          json={"problem_set_id": s["id"], "duration_minutes": 15, "shuffle": False, "kind": "official"}, headers=teacher)
    assert r.status_code == 201, r.text
    a = r.json()
    # Bộ đề luôn là bài ôn tập (không theo đề THPT), tên mặc định lấy từ bộ đề
    assert a["title"] == "Kiểm tra 15 phút" and a["kind"] == "practice" and a["mode"] == "choice" and a["size"] == 5
    assert a["duration_minutes"] == 15

    exam_id = (await client.post(f"/api/assignments/{a['id']}/start", headers=hs)).json()["exam_id"]
    exam = (await client.get(f"/api/exams/{exam_id}", headers=hs)).json()
    assert [q["statement"] for q in exam["questions"]] == [q["statement"] for q in s["questions"]]
    answers = await answers_of(exam_id)
    r = await client.post(f"/api/exams/{exam_id}/submit", json={"answers": answers}, headers=hs)
    assert r.json()["result"]["score"] == 10

    # Sửa bộ đề sau khi giao không đổi bài đã giao
    await client.patch(f"/api/problem-sets/{s['id']}", json={"order": []}, headers=teacher)
    report = (await client.get(f"/api/assignments/{a['id']}/report", headers=teacher)).json()
    assert len(report["questions"]) == 5 and report["summary"]["average_score"] == 10
    # Bộ đề rỗng / của giáo viên khác thì không giao được
    empty = await client.post(f"/api/classes/{c['id']}/assignments", json={"problem_set_id": s["id"]}, headers=teacher)
    assert empty.json()["code"] == "set_empty"
    assert (await client.post(f"/api/classes/{c['id']}/assignments", json={"problem_set_id": "khongco"}, headers=teacher)).status_code == 404
