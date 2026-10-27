"""Làm đề: tạo đề ôn tập / đề thi THPT từ bộ sinh đề, chấm bài, lịch sử đề.

Câu hỏi được sinh và lưu khi tạo đề (kèm đáp án), nên chấm bài chỉ so với đáp án đã lưu, không sinh lại.
"""

import math
from datetime import UTC, datetime, timedelta
from fractions import Fraction

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.core.ids import new_id
from app.modules.exams.generator import ALGEBRA, BY_CODE, TEMPLATES, THPT, THPT_BLUEPRINT, Rng, build_questions, build_thpt, generate
from app.modules.exams.models import Exam, ExamQuestion
from app.modules.exams.schemas import (
    CreateExamIn, ExamOut, ExamQuestionOut, ExamResult, ExamSummary, SubmitExamIn, TemplateInfo, TemplateRef,
)
from app.modules.learning import service as learning
from app.modules.learning.grading import same_number
from app.modules.problem_bank import service as bank
from app.modules.problem_bank.schemas import SkillOut
from app.modules.users.models import User

EXAM_SIZES = {"choice": [10, 20, 40, 100], "written": [5, 10, 20, 40]}
# Đúng/Sai: điểm theo số ý đúng (0–4 ý)
TF_POINTS = [Fraction(0), Fraction(1, 10), Fraction(1, 4), Fraction(1, 2), Fraction(1)]
RECENT = 10
OFFICIAL_TITLE = "Đề thi tốt nghiệp THPT · Môn Toán"


# Kho dạng bài của Đấu trường: chỉ câu một đáp án (A/B/C/D hoặc điền số), trả lời nhanh được
ARENA_POOLS = {"basic": ALGEBRA, "thpt": THPT}


def templates() -> list[TemplateInfo]:
    return [TemplateInfo(**t.info()) for t in TEMPLATES]


def arena_templates(pool: str) -> list[TemplateInfo]:
    return [TemplateInfo(**t.info()) for t in ARENA_POOLS[pool] if t.type != "true_false"]


def _from_generated(template_code: str, q: dict) -> dict:
    t = BY_CODE[template_code]
    return {
        "type": t.type, "template_code": t.code, "template_name": t.name, "skill_code": t.skill, "grade": t.grade,
        "difficulty": t.difficulty, "statement": q["statement"], "choices": q.get("choices"), "statements": q.get("statements"),
        "answer_prefix": q.get("answer_prefix"), "answer": q["answer"], "answer_display": q["answer_display"],
        "solution": q["solution"], "tolerance": q.get("tolerance"),
    }


COPY_FIELDS = ("type", "template_code", "template_name", "skill_code", "grade", "difficulty", "statement", "choices",
               "statements", "answer_prefix", "answer", "answer_display", "solution", "tolerance")


def generate_rows(kind: str, mode: str | None, size: int | None, skills: list[str] | None = None,
                  templates: list[str] | None = None) -> tuple[str, list[dict]]:
    """Sinh câu hỏi mới cho đề ôn tập hoặc đề thi THPT (dùng chung cho đề tự tạo và bài giao của lớp).
    Trả về (hình thức, các dòng câu hỏi)."""
    g = Rng()
    if kind == "official":
        return "choice", [_from_generated(t.code, q) for t, q in build_thpt(g)]
    if mode is None or size not in EXAM_SIZES[mode]:
        raise ApiError(422, "validation_error")
    built = build_questions(mode, size, g, skills=skills, templates=templates)
    if not built:
        raise ApiError(422, "no_template")
    return mode, [_from_generated(t.code, q) for t, q in built]


def generate_from_templates(codes: list[str]) -> list[dict]:
    """Sinh một câu cho mỗi mã dạng bài (lặp mã để lấy nhiều câu), theo đúng thứ tự (bộ đề của giáo viên)."""
    if any(c not in BY_CODE for c in codes):
        raise ApiError(422, "no_template")
    return [_from_generated(t.code, q) for t, q in generate([BY_CODE[c] for c in codes], Rng())]


async def _owned(db: AsyncSession, user: User, exam_id: str, *, lock: bool = False) -> Exam:
    stmt = select(Exam).where(Exam.id == exam_id, Exam.user_id == user.id)
    exam = await db.scalar(stmt.with_for_update() if lock else stmt)
    if not exam:  # đề của người khác cũng trả 404, không để lộ là đề có tồn tại
        raise ApiError(404, "not_found")
    return exam


async def _questions(db: AsyncSession, exam_id: str) -> list[ExamQuestion]:
    return list(await db.scalars(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id).order_by(ExamQuestion.position)))


async def _out(db: AsyncSession, exam: Exam, qs: list[ExamQuestion]) -> ExamOut:
    names = await bank.skill_names(db)
    return ExamOut(
        id=exam.id, title=exam.title, kind=exam.kind, mode=exam.mode, size=exam.size, created_at=exam.created_at,
        duration_minutes=exam.duration_minutes, ends_at=exam.ends_at, result=exam.result, assignment_id=exam.assignment_id,
        # Bài làm chỉ trả về sau khi nộp: xem lại trên máy khác vẫn thấy mình đã chọn gì
        answers=exam.answers if exam.result else None,
        questions=[
            ExamQuestionOut(
                id=q.id, index=q.position, type=q.type, template=TemplateRef(code=q.template_code, name=q.template_name),
                skill=SkillOut(code=q.skill_code, name=names.get(q.skill_code, q.skill_code)), grade=q.grade,
                difficulty=q.difficulty, statement=q.statement, choices=q.choices, statements=q.statements,
                answer_prefix=q.answer_prefix,
            )
            for q in qs
        ],
    )


async def create(db: AsyncSession, user: User, body: CreateExamIn) -> ExamOut:
    kind, duration = "practice", None
    if body.kind == "official":
        if body.blueprint != "thpt":
            raise ApiError(422, "validation_error")
        kind, title, duration = "official", OFFICIAL_TITLE, THPT_BLUEPRINT["duration_minutes"]
        mode, rows = generate_rows(kind, None, None)
    elif body.retry_of:
        orig = await _owned(db, user, body.retry_of)
        if not orig.result:
            raise ApiError(404, "not_found")
        wrong = {i["question_id"] for i in orig.result["items"] if not i["is_correct"]}
        rows = [{f: getattr(q, f) for f in COPY_FIELDS} for q in await _questions(db, orig.id) if q.id in wrong]
        if not rows:
            raise ApiError(422, "validation_error")
        mode, title = orig.mode, f"Làm lại {len(rows)} câu sai"
    else:
        mode, rows = generate_rows(kind, body.mode, body.size, body.skills, body.templates)
        label = "Ôn dạng đã sai" if body.templates else "Đề ôn tập trắc nghiệm" if mode == "choice" else "Đề ôn tập tự luận"
        title = f"{label} · {body.size} câu"

    now = datetime.now(UTC)
    exam, qs = add_exam(db, user, title, kind, mode, rows, duration, now + timedelta(minutes=duration) if duration else None, now)
    await db.commit()
    return await _out(db, exam, qs)


def add_exam(db: AsyncSession, user: User, title: str, kind: str, mode: str, rows: list[dict], duration: int | None,
             ends_at: datetime | None, now: datetime, assignment_id: str | None = None) -> tuple[Exam, list[ExamQuestion]]:
    """Thêm đề và câu hỏi vào phiên (chưa commit). Mã ULID sinh ở ứng dụng nên không cần flush để lấy exam.id."""
    exam = Exam(id=new_id(), user_id=user.id, title=title, kind=kind, mode=mode, size=len(rows), created_at=now,
                duration_minutes=duration, ends_at=ends_at, assignment_id=assignment_id)
    qs = [ExamQuestion(id=f"{exam.id}_q{i}", exam_id=exam.id, position=i, **row) for i, row in enumerate(rows, start=1)]
    db.add(exam)
    db.add_all(qs)
    return exam, qs


async def get(db: AsyncSession, user: User, exam_id: str) -> ExamOut:
    return await detail(db, await _owned(db, user, exam_id))


async def detail(db: AsyncSession, exam: Exam) -> ExamOut:
    """Đề kèm câu hỏi. Người gọi đã kiểm tra quyền xem."""
    return await _out(db, exam, await _questions(db, exam.id))


async def recent(db: AsyncSession, user: User) -> list[ExamSummary]:
    rows = await db.scalars(select(Exam).where(Exam.user_id == user.id).order_by(Exam.created_at.desc()).limit(RECENT))
    return [
        ExamSummary(id=e.id, title=e.title, kind=e.kind, mode=e.mode, size=e.size, created_at=e.created_at,
                    score=e.result["score"] if e.result else None, correct=e.result["correct"] if e.result else None)
        for e in rows
    ]



# ---------------------------------------------------------------- đề của bài giao (module classroom gọi)

async def assignment_exams(db: AsyncSession, assignment_ids: list[str], user_ids: list[str] | None = None,
                           submitted: bool = False) -> list[Exam]:
    """Đề học sinh làm cho các bài giao (lọc theo học sinh, chỉ đề đã nộp nếu `submitted`)."""
    if not assignment_ids:
        return []
    stmt = select(Exam).where(Exam.assignment_id.in_(assignment_ids))
    if user_ids is not None:
        stmt = stmt.where(Exam.user_id.in_(user_ids))
    if submitted:
        stmt = stmt.where(Exam.result.is_not(None))
    return list(await db.scalars(stmt))


async def assignment_exam(db: AsyncSession, assignment_id: str, user_id: str) -> Exam | None:
    return await db.scalar(select(Exam).where(Exam.assignment_id == assignment_id, Exam.user_id == user_id))


async def source_indexes(db: AsyncSession, exam_ids: list[str]) -> dict[str, int | None]:
    """Mã câu hỏi → vị trí của câu trong bài giao (đề đảo câu thì mỗi học sinh một thứ tự)."""
    if not exam_ids:
        return {}
    return dict((await db.execute(select(ExamQuestion.id, ExamQuestion.source_index).where(ExamQuestion.exam_id.in_(exam_ids)))).all())


# ---------------------------------------------------------------- chấm bài

def points(q: ExamQuestion, given: dict | None) -> Fraction:
    return _points(q.answer, q.tolerance, given)


def row_points(row: dict, given: dict | None) -> float:
    """Chấm một câu lưu dạng dict (câu của Đấu trường)."""
    return float(_points(row["answer"], row.get("tolerance"), given))


def _points(exp: dict, tolerance: float | None, given: dict | None) -> Fraction:
    if not given or given.get("type") != exp["type"]:
        return Fraction(0)
    if exp["type"] == "choice":
        return Fraction(int(str(given["value"]).strip().upper() == exp["value"]))
    if exp["type"] == "number":
        tol = Fraction(tolerance).limit_denominator(10**6) if tolerance else None
        return Fraction(int(same_number(str(given["value"]), str(exp["value"]), tol)))
    matches = sum(1 for k, v in exp["value"].items() if given["value"].get(k) is v)
    return TF_POINTS[matches]


def round2(x: Fraction) -> float:
    """Làm tròn 2 chữ số, nửa lên (như Math.round ở frontend), tính trên phân số chính xác."""
    return math.floor(x * 100 + Fraction(1, 2)) / 100


def grade_exam(exam: Exam, qs: list[ExamQuestion], answers: dict[str, dict], now: datetime) -> ExamResult:
    pts = [points(q, answers.get(q.id)) for q in qs]
    items = [
        {"question_id": q.id, "is_correct": p == 1, "points": float(p), "correct_answer": q.answer,
         "correct_answer_display": q.answer_display, "solution": q.solution}
        for q, p in zip(qs, pts)
    ]
    parts = []
    if exam.kind == "official":
        # Đề thi: mỗi loại câu có trọng số riêng (Phần I 0,25 · Phần II tối đa 1 · Phần III 0,5) → tổng 10
        for part in THPT_BLUEPRINT["parts"]:
            weight = Fraction(str(part["points"]))
            earned = sum((p for q, p in zip(qs, pts) if q.type == part["type"]), Fraction(0)) * weight
            parts.append({"label": f"Phần {part['part']}", "earned": round2(earned), "max": float(part["count"] * weight)})
        score = round2(sum((Fraction(str(p["earned"])) for p in parts), Fraction(0)))
    else:
        # Đề ôn tập: các câu bằng điểm nhau, quy về thang 10
        score = round2(sum(pts, Fraction(0)) / len(qs) * 10)
    wrong = {q.template_code: TemplateRef(code=q.template_code, name=q.template_name) for q, p in zip(qs, pts) if p != 1}
    return ExamResult(correct=sum(p == 1 for p in pts), total=len(qs), score=score, parts=parts, items=items,
                      wrong_templates=list(wrong.values()), submitted_at=now)


async def submit(db: AsyncSession, user: User, exam_id: str, body: SubmitExamIn) -> ExamOut:
    # Khóa dòng: hai lần nộp song song (bấm hai lần, client thử lại) không chấm hai lần
    exam = await _owned(db, user, exam_id, lock=True)
    qs = await _questions(db, exam.id)
    if exam.result is not None:  # nộp lại: trả kết quả cũ, rồi nhả khóa
        out = await _out(db, exam, qs)
        await db.rollback()
        return out
    ids = {q.id for q in qs}
    answers = {k: v.model_dump() for k, v in body.answers.items() if k in ids}
    result = grade_exam(exam, qs, answers, datetime.now(UTC))
    exam.answers, exam.result, exam.submitted_at = answers, result.model_dump(mode="json"), result.submitted_at
    await learning.record_activity(db, user.id, len(answers))
    await db.commit()
    # Sau khi commit mới đẩy task: worker cập nhật điểm kỹ năng (trọng số nhỏ hơn luyện tập từng bài)
    learning.schedule_exam_scores(user.id, [(q.skill_code, i.is_correct) for q, i in zip(qs, result.items)])
    return await _out(db, exam, qs)
