import re
from collections import Counter
from pathlib import Path

import pytest
from sqlalchemy import select

from app.modules.exams.generator import TEMPLATES, Rng, build_questions, build_thpt
from app.modules.exams.models import ExamQuestion
from app.modules.learning.grading import parse_number

WEB_MOCKS = Path(__file__).resolve().parents[2] / "web" / "src" / "mocks"


def balanced(s: str) -> bool:
    depth = 0
    for ch in s.replace(r"\{", "").replace(r"\}", ""):
        depth += (ch == "{") - (ch == "}")
        if depth < 0:
            return False
    return depth == 0


# ---------------------------------------------------------------- bộ sinh đề (hàm thuần)

@pytest.mark.parametrize("t", TEMPLATES, ids=lambda t: t.code)
def test_dang_bai_sinh_cau_hop_le(t):
    for seed in range(200):
        q = t.make(Rng(seed))
        texts = [q["statement"], q["answer_display"], *q["solution"],
                 *(c["content"] for c in q.get("choices", [])), *(s["content"] for s in q.get("statements", []))]
        for s in texts:  # LaTeX: ngoặc nhọn cân và số dấu $ chẵn
            assert balanced(s) and s.count("$") % 2 == 0, (seed, s)
        if t.type == "choice":
            contents = [c["content"] for c in q["choices"]]
            assert len(set(contents)) == 4, (seed, contents)
            assert q["answer"]["value"] in {c["key"] for c in q["choices"]}
        elif t.type == "true_false":
            assert [s["key"] for s in q["statements"]] == ["a", "b", "c", "d"]
            assert set(q["answer"]["value"]) == {"a", "b", "c", "d"}
        else:
            assert parse_number(q["answer"]["value"]) is not None


def test_cung_seed_thi_cung_de():
    assert build_thpt(Rng(7))[0][1] == build_thpt(Rng(7))[0][1]


def test_khop_danh_sach_dang_bai_cua_frontend():
    """62 dạng bài của backend khớp với bộ sinh đề trong mock (mã, kỹ năng, hình thức, loại câu)."""
    if not WEB_MOCKS.exists():
        pytest.skip("không có apps/web")
    src = "".join((WEB_MOCKS / f).read_text(encoding="utf8") for f in ("exam-generator.ts", "thpt-templates.ts", "primary-templates.ts"))
    pat = re.compile(r'code: "(\w+)", name: "([^"]+)", skill: "(\w+)", grade: (\d+), difficulty: ([\d.]+), mode: "(\w+)", type: "(\w+)"')
    web = {m[0]: (m[1], m[2], int(m[3]), float(m[4]), m[5], m[6]) for m in pat.findall(src)}
    api = {t.code: (t.name, t.skill, t.grade, t.difficulty, t.mode, t.type) for t in TEMPLATES}
    assert len(api) == 62 and api == web


def test_de_thpt_dung_cau_truc_va_phu_du_chu_de():
    for seed in range(30):
        built = build_thpt(Rng(seed))
        assert [t.type for t, _ in built] == ["choice"] * 12 + ["true_false"] * 4 + ["number"] * 6
        part1 = {t.skill for t, _ in built[:12]}
        assert {"calculus", "exp_log", "geometry_space", "coordinates_3d", "probability_statistics", "sequences"} <= part1


def test_de_on_tap_trac_nghiem_co_20_phan_tram_dung_sai():
    built = build_questions("choice", 20, Rng(1))
    assert Counter(t.type for t, _ in built) == {"choice": 16, "true_false": 4}
    written = build_questions("written", 10, Rng(1))
    assert {t.type for t, _ in written} == {"number"}
    assert build_questions("choice", 10, Rng(1), skills=["khong_co"]) is None


# ---------------------------------------------------------------- API

async def answers_of(exam_id: str) -> dict[str, dict]:
    from app.core.db import SessionLocal

    async with SessionLocal() as db:
        return {q.id: q.answer for q in await db.scalars(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id))}


async def test_tao_de_on_tap_khong_lo_dap_an(client, student):
    r = await client.post("/api/exams", json={"mode": "choice", "size": 10}, headers=student)
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["kind"] == "practice" and e["size"] == 10 and e["result"] is None and e["ends_at"] is None
    assert [q["index"] for q in e["questions"]] == list(range(1, 11))
    for q in e["questions"]:
        assert not {"answer", "answer_display", "solution", "tolerance"} & q.keys()
        assert ("choices" in q) == (q["type"] == "choice") and ("statements" in q) == (q["type"] == "true_false")
    assert (await client.get(f"/api/exams/{e['id']}", headers=student)).json()["questions"] == e["questions"]


@pytest.mark.parametrize("body,code", [
    ({"mode": "choice", "size": 7}, "validation_error"),
    ({"mode": "written", "size": 100}, "validation_error"),
    ({"kind": "official"}, "validation_error"),
    ({"mode": "choice", "size": 10, "skills": ["khong_co"]}, "no_template"),
    ({"templates": ["khong_co"], "mode": "choice", "size": 10}, "no_template"),
])
async def test_tao_de_sai_tham_so(client, student, body, code):
    r = await client.post("/api/exams", json=body, headers=student)
    assert r.status_code == 422 and r.json()["code"] == code


async def test_de_thi_thpt_cham_dung_het_duoc_10_diem(client, student):
    e = (await client.post("/api/exams", json={"kind": "official", "blueprint": "thpt"}, headers=student)).json()
    assert e["kind"] == "official" and e["duration_minutes"] == 90 and e["ends_at"] and len(e["questions"]) == 22
    answers = await answers_of(e["id"])
    done = (await client.post(f"/api/exams/{e['id']}/submit", json={"answers": answers}, headers=student)).json()
    res = done["result"]
    assert res["score"] == 10 and res["correct"] == 22 and res["wrong_templates"] == []
    assert [(p["label"], p["max"]) for p in res["parts"]] == [("Phần I", 3.0), ("Phần II", 4.0), ("Phần III", 3.0)]


async def test_cham_dung_sai_tung_phan_va_nop_lai_khong_cham_lai(client, student):
    e = (await client.post("/api/exams", json={"kind": "official", "blueprint": "thpt"}, headers=student)).json()
    answers = await answers_of(e["id"])
    qs = e["questions"]
    given = {}
    for q in qs:
        a = answers[q["id"]]
        if q["type"] == "true_false":  # sai đúng 1 ý → 0,5 điểm của câu
            flipped = dict(a["value"]) | {"a": not a["value"]["a"]}
            given[q["id"]] = {"type": "true_false", "value": flipped}
        elif q["type"] == "number" and q["index"] == 17:
            given[q["id"]] = {"type": "number", "value": "123456"}  # sai
        elif q["type"] == "number":
            given[q["id"]] = a
        # Phần I: bỏ trống hết → 0 điểm
    r1 = (await client.post(f"/api/exams/{e['id']}/submit", json={"answers": given}, headers=student)).json()["result"]
    by_id = {i["question_id"]: i for i in r1["items"]}
    assert {by_id[q["id"]]["points"] for q in qs if q["type"] == "true_false"} == {0.5}
    assert [p["earned"] for p in r1["parts"]] == [0.0, 2.0, 2.5]
    assert r1["score"] == 4.5 and r1["correct"] == 5
    # Nộp lại (mạng lỗi, bấm hai lần): trả kết quả cũ, không chấm lại với đáp án mới
    r2 = (await client.post(f"/api/exams/{e['id']}/submit", json={"answers": answers}, headers=student)).json()["result"]
    assert r2 == r1

    # Làm lại câu sai: 12 câu Phần I + 4 câu Đúng/Sai + 1 câu trả lời ngắn
    retry = (await client.post("/api/exams", json={"retry_of": e["id"]}, headers=student)).json()
    assert retry["title"] == "Làm lại 17 câu sai" and retry["kind"] == "practice"
    assert [q["statement"] for q in retry["questions"]] == [q["statement"] for q in qs if by_id[q["id"]]["is_correct"] is False]

    # Đề mới từ các dạng đã sai: chỉ gồm các dạng đó
    codes = [t["code"] for t in r1["wrong_templates"]]
    fresh = (await client.post("/api/exams", json={"templates": codes, "mode": "choice", "size": 10}, headers=student)).json()
    assert {q["template"]["code"] for q in fresh["questions"]} <= set(codes)


async def test_diem_de_on_tap_quy_ve_thang_10_va_cap_nhat_tien_do(client, student):
    before = (await client.get("/api/me/progress", headers=student)).json()
    e = (await client.post("/api/exams", json={"mode": "written", "size": 5, "skills": ["inequality"]}, headers=student)).json()
    answers = await answers_of(e["id"])
    first_two = dict(list(answers.items())[:2])
    res = (await client.post(f"/api/exams/{e['id']}/submit", json={"answers": first_two}, headers=student)).json()["result"]
    assert res["score"] == 4 and res["correct"] == 2 and res["parts"] == []
    after = (await client.get("/api/me/progress", headers=student)).json()
    assert after["today_attempts"] == before["today_attempts"] + 2  # chỉ tính câu đã làm
    skill = lambda p: next(s for s in p["skills"] if s["code"] == "inequality")  # noqa: E731
    assert skill(after)["n_attempts"] == skill(before)["n_attempts"] + 5  # worker (chạy eager trong test) đã cập nhật


async def test_lich_su_de_va_quyen_xem(client, student, teacher):
    e = (await client.post("/api/exams", json={"mode": "choice", "size": 10}, headers=student)).json()
    recent = (await client.get("/api/exams", headers=student)).json()
    assert recent[0]["id"] == e["id"] and recent[0]["score"] is None and len(recent) <= 10
    assert (await client.get(f"/api/exams/{e['id']}", headers=teacher)).status_code == 404
    assert (await client.post(f"/api/exams/{e['id']}/submit", json={"answers": {}}, headers=teacher)).status_code == 404
    assert (await client.get("/api/exams")).status_code == 401
    templates = (await client.get("/api/exams/templates", headers=student)).json()
    assert len(templates) == 62 and sum("part" in t for t in templates) == 25 and sum(t["grade"] <= 5 for t in templates) == 20
