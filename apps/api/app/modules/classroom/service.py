"""Lớp học: giáo viên tạo lớp, học sinh vào lớp bằng mã, giáo viên giao bài và xem báo cáo, bảng xếp hạng lớp.

Bài giao dùng lại bộ sinh đề và phần chấm của module exams: câu hỏi sinh một lần khi giao, mỗi học sinh làm trên
một Exam chép từ bài giao (`Exam.assignment_id`), nên báo cáo chỉ cần đọc kết quả các Exam đó.
"""

import random
import secrets
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.modules.classroom.models import Assignment, ClassMember, Classroom
from app.modules.classroom.schemas import (
    AssignmentOut, AssignmentReport, ClassDetailOut, ClassOut, CreateAssignmentIn, CreateClassIn, LeaderboardRow, MemberOut,
    QuestionStat, ReportSummary, SkillStat, StudentResult,
)
from app.modules.exams import service as exams
from app.modules.exams.generator import THPT_BLUEPRINT
from app.modules.exams.models import Exam
from app.modules.exams.schemas import ExamOut, TemplateRef
from app.modules.learning import service as learning
from app.modules.problem_bank import service as bank
from app.modules.problem_bank.schemas import SkillOut
from app.modules.problem_sets import service as problem_sets
from app.modules.users.models import User

# Bỏ chữ dễ nhầm (I/1, O/0, L) để học sinh đọc mã trên bảng không gõ sai
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
# Nộp tự động đúng lúc hết hạn có thể đến muộn vài giây qua mạng: chưa tính là nộp muộn
GRACE = timedelta(minutes=2)
MY_ASSIGNMENTS = 50
STREAK_WINDOW_DAYS = 120


def new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def normalize_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def is_teacher(user: User) -> bool:
    return user.role in ("teacher", "admin")


async def _teacher_class(db: AsyncSession, user: User, class_id: str) -> Classroom:
    c = await db.get(Classroom, class_id)
    if not c or (c.teacher_id != user.id and user.role != "admin"):
        raise ApiError(404, "not_found")
    return c


async def _is_member(db: AsyncSession, class_id: str, user_id: str) -> bool:
    return await db.get(ClassMember, (class_id, user_id)) is not None


async def _visible_class(db: AsyncSession, user: User, class_id: str) -> Classroom:
    """Giáo viên của lớp hoặc học sinh trong lớp. Người ngoài nhận 404, không lộ là lớp có tồn tại."""
    c = await db.get(Classroom, class_id)
    if not c:
        raise ApiError(404, "not_found")
    if c.teacher_id == user.id or user.role == "admin" or await _is_member(db, c.id, user.id):
        return c
    raise ApiError(404, "not_found")


def status_of(a: Assignment, exam: Exam | None, now: datetime) -> str:
    if exam is not None and exam.result is not None:
        return "late" if a.due_at and exam.submitted_at > a.due_at + GRACE else "submitted"
    if a.due_at and now > a.due_at + GRACE:
        return "missed"
    return "in_progress" if exam is not None else "todo"


def _score(exam: Exam | None) -> float | None:
    return exam.result["score"] if exam is not None and exam.result else None


def _mean(xs: list[float]) -> float | None:
    return exams.round2(sum(xs) / len(xs)) if xs else None


# ---------------------------------------------------------------- lớp học

async def _counts(db: AsyncSession, class_ids: list[str]) -> tuple[dict[str, int], dict[str, int]]:
    if not class_ids:
        return {}, {}
    members = dict((await db.execute(select(ClassMember.class_id, func.count()).where(ClassMember.class_id.in_(class_ids))
                                     .group_by(ClassMember.class_id))).all())
    assigned = dict((await db.execute(select(Assignment.class_id, func.count()).where(Assignment.class_id.in_(class_ids))
                                      .group_by(Assignment.class_id))).all())
    return members, assigned


def _class_out(c: Classroom, teacher_name: str, members: dict, assigned: dict, *, owner: bool, pending: int = 0) -> ClassOut:
    return ClassOut(id=c.id, name=c.name, grade=c.grade, teacher_name=teacher_name, join_code=c.join_code if owner else None,
                    member_count=members.get(c.id, 0), assignment_count=assigned.get(c.id, 0), pending_count=pending,
                    created_at=c.created_at)


async def create_class(db: AsyncSession, user: User, body: CreateClassIn) -> ClassOut:
    for _ in range(5):  # 31^6 ≈ 887 triệu mã: trùng rất hiếm, thử lại vài lần là đủ
        c = Classroom(teacher_id=user.id, name=body.name.strip(), grade=body.grade, join_code=new_code(), created_at=datetime.now(UTC))
        db.add(c)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            continue
        return _class_out(c, user.full_name, {}, {}, owner=True)
    raise ApiError(503, "error")


async def list_classes(db: AsyncSession, user: User) -> list[ClassOut]:
    if is_teacher(user):
        rows = list(await db.scalars(select(Classroom).where(Classroom.teacher_id == user.id).order_by(Classroom.created_at.desc())))
        members, assigned = await _counts(db, [c.id for c in rows])
        return [_class_out(c, user.full_name, members, assigned, owner=True) for c in rows]

    rows = (await db.execute(
        select(Classroom, User.full_name).join(ClassMember, ClassMember.class_id == Classroom.id)
        .join(User, User.id == Classroom.teacher_id).where(ClassMember.user_id == user.id).order_by(ClassMember.joined_at.desc())
    )).all()
    ids = [c.id for c, _ in rows]
    members, assigned = await _counts(db, ids)
    pending: dict[str, int] = defaultdict(int)
    now = datetime.now(UTC)
    for a, exam in await _assignments_with_my_exam(db, user, ids):
        if status_of(a, exam, now) in ("todo", "in_progress"):
            pending[a.class_id] += 1
    return [_class_out(c, name, members, assigned, owner=False, pending=pending[c.id]) for c, name in rows]


async def get_class(db: AsyncSession, user: User, class_id: str) -> ClassDetailOut:
    c = await _visible_class(db, user, class_id)
    owner = c.teacher_id == user.id or user.role == "admin"
    teacher = await db.get(User, c.teacher_id)
    members, assigned = await _counts(db, [c.id])
    out = ClassDetailOut(**_class_out(c, teacher.full_name, members, assigned, owner=owner).model_dump())
    if owner:
        rows = (await db.execute(
            select(User, ClassMember.joined_at).join(ClassMember, ClassMember.user_id == User.id)
            .where(ClassMember.class_id == c.id).order_by(User.full_name)
        )).all()
        out.members = [MemberOut(id=u.id, full_name=u.full_name, email=u.email, grade=u.grade, joined_at=j) for u, j in rows]
    return out


async def join(db: AsyncSession, user: User, code: str) -> ClassOut:
    if user.role != "student":
        raise ApiError(403, "forbidden")
    c = await db.scalar(select(Classroom).where(Classroom.join_code == normalize_code(code)))
    if not c:
        raise ApiError(404, "class_not_found")
    if not await _is_member(db, c.id, user.id):
        db.add(ClassMember(class_id=c.id, user_id=user.id))
        try:
            await db.commit()
        except IntegrityError:  # bấm hai lần: lượt kia đã thêm
            await db.rollback()
    return next(x for x in await list_classes(db, user) if x.id == c.id)


async def remove_member(db: AsyncSession, user: User, class_id: str, member_id: str) -> None:
    """Giáo viên xóa học sinh khỏi lớp, hoặc học sinh tự rời lớp. Bài đã làm vẫn còn trong lịch sử của học sinh."""
    if member_id == user.id:
        await _visible_class(db, user, class_id)
    else:
        await _teacher_class(db, user, class_id)
    await db.execute(delete(ClassMember).where(ClassMember.class_id == class_id, ClassMember.user_id == member_id))
    await db.commit()


async def reset_code(db: AsyncSession, user: User, class_id: str) -> ClassDetailOut:
    c = await _teacher_class(db, user, class_id)
    for _ in range(5):
        c.join_code = new_code()
        try:
            await db.commit()
            return await get_class(db, user, class_id)
        except IntegrityError:
            await db.rollback()
            c = await _teacher_class(db, user, class_id)
    raise ApiError(503, "error")


async def delete_class(db: AsyncSession, user: User, class_id: str) -> None:
    await db.delete(await _teacher_class(db, user, class_id))
    await db.commit()


# ---------------------------------------------------------------- bài giao

def _assignment_out(a: Assignment, class_name: str, **extra) -> AssignmentOut:
    return AssignmentOut(id=a.id, class_id=a.class_id, class_name=class_name, title=a.title, kind=a.kind, mode=a.mode, size=a.size,
                         duration_minutes=a.duration_minutes, due_at=a.due_at, shuffle=a.shuffle, created_at=a.created_at, **extra)


def _default_title(body: CreateAssignmentIn, size: int) -> str:
    if body.kind == "official":
        return exams.OFFICIAL_TITLE
    return f"Bài tập {'trắc nghiệm' if body.mode == 'choice' else 'tự luận'} · {size} câu"


async def create_assignment(db: AsyncSession, user: User, class_id: str, body: CreateAssignmentIn) -> AssignmentOut:
    c = await _teacher_class(db, user, class_id)
    now = datetime.now(UTC)
    due = body.due_at.replace(tzinfo=UTC) if body.due_at and body.due_at.tzinfo is None else body.due_at
    if due and due <= now:
        raise ApiError(422, "due_in_past")
    kind = "practice" if body.problem_set_id else body.kind
    if body.problem_set_id:
        default_title, mode, rows = await problem_sets.assignment_rows(db, user, body.problem_set_id)
    else:
        mode, rows = exams.generate_rows(kind, body.mode, body.size, body.skills)
        default_title = _default_title(body, len(rows))
    duration = THPT_BLUEPRINT["duration_minutes"] if kind == "official" else body.duration_minutes
    a = Assignment(class_id=c.id, title=(body.title or "").strip() or default_title, kind=kind, mode=mode,
                   size=len(rows), duration_minutes=duration, due_at=due, shuffle=body.shuffle, questions=rows, created_at=now)
    db.add(a)
    await db.commit()
    members, _ = await _counts(db, [c.id])
    return _assignment_out(a, c.name, member_count=members.get(c.id, 0), submitted_count=0, average_score=None)


async def _assignments_with_my_exam(db: AsyncSession, user: User, class_ids: list[str]) -> list[tuple[Assignment, Exam | None]]:
    if not class_ids:
        return []
    assignments = list(await db.scalars(select(Assignment).where(Assignment.class_id.in_(class_ids)).order_by(Assignment.created_at.desc())))
    mine = {e.assignment_id: e for e in await exams.assignment_exams(db, [a.id for a in assignments], [user.id])}
    return [(a, mine.get(a.id)) for a in assignments]


def _student_view(a: Assignment, exam: Exam | None, class_name: str, now: datetime) -> AssignmentOut:
    return _assignment_out(a, class_name, status=status_of(a, exam, now), exam_id=exam.id if exam else None, score=_score(exam))


async def list_assignments(db: AsyncSession, user: User, class_id: str) -> list[AssignmentOut]:
    c = await _visible_class(db, user, class_id)
    now = datetime.now(UTC)
    if not (c.teacher_id == user.id or user.role == "admin"):
        return [_student_view(a, e, c.name, now) for a, e in await _assignments_with_my_exam(db, user, [c.id])]

    assignments = list(await db.scalars(select(Assignment).where(Assignment.class_id == c.id).order_by(Assignment.created_at.desc())))
    member_ids = set(await db.scalars(select(ClassMember.user_id).where(ClassMember.class_id == c.id)))
    scores: dict[str, list[float]] = defaultdict(list)
    for e in await exams.assignment_exams(db, [a.id for a in assignments], list(member_ids), submitted=True):
        scores[e.assignment_id].append(e.result["score"])
    return [_assignment_out(a, c.name, member_count=len(member_ids), submitted_count=len(scores[a.id]), average_score=_mean(scores[a.id]))
            for a in assignments]


async def my_assignments(db: AsyncSession, user: User) -> list[AssignmentOut]:
    rows = (await db.execute(
        select(Classroom.id, Classroom.name).join(ClassMember, ClassMember.class_id == Classroom.id).where(ClassMember.user_id == user.id)
    )).all()
    names = dict(rows)
    now = datetime.now(UTC)
    out = [_student_view(a, e, names[a.class_id], now) for a, e in await _assignments_with_my_exam(db, user, list(names))]
    # Bài còn phải làm lên trước, hạn gần trước (không có hạn thì sau cùng); bài đã xong / quá hạn giữ thứ tự mới nhất trước
    todo = sorted((x for x in out if x.status in ("todo", "in_progress")), key=lambda x: (x.due_at is None, x.due_at or x.created_at))
    return [*todo, *(x for x in out if x.status not in ("todo", "in_progress"))][:MY_ASSIGNMENTS]


def _shuffled(rows: list[dict], shuffle: bool) -> list[dict]:
    """Gắn vị trí gốc cho từng câu; khi đảo câu thì chỉ đảo trong cùng một phần (giữ cấu trúc Phần I → II → III)."""
    indexed = [{**r, "source_index": i} for i, r in enumerate(rows, start=1)]
    if not shuffle:
        return indexed
    groups: dict[str, list[dict]] = {}
    for r in indexed:
        groups.setdefault(r["type"], []).append(r)
    rng = random.SystemRandom()
    for g in groups.values():
        rng.shuffle(g)
    return [r for g in groups.values() for r in g]


async def start(db: AsyncSession, user: User, assignment_id: str) -> str:
    """Học sinh bắt đầu (hoặc mở lại) bài giao. Trả về mã Exam để làm bài ở trang làm đề."""
    a = await db.get(Assignment, assignment_id)
    if not a or not await _is_member(db, a.class_id, user.id):
        raise ApiError(404, "not_found")
    existing = await exams.assignment_exam(db, a.id, user.id)
    if existing:
        return existing.id
    now = datetime.now(UTC)
    if a.due_at and now > a.due_at:
        raise ApiError(422, "assignment_closed")
    ends_at = now + timedelta(minutes=a.duration_minutes) if a.duration_minutes else None
    if ends_at and a.due_at:
        ends_at = min(ends_at, a.due_at)  # bắt đầu sát hạn thì chỉ còn đến hạn nộp
    exam, _ = exams.add_exam(db, user, a.title, a.kind, a.mode, _shuffled(a.questions, a.shuffle), a.duration_minutes, ends_at, now,
                             assignment_id=a.id)
    try:
        await db.commit()
    except IntegrityError:  # hai lần bấm song song: lượt kia đã tạo đề
        await db.rollback()
        return (await exams.assignment_exam(db, a.id, user.id)).id
    return exam.id


async def delete_assignment(db: AsyncSession, user: User, assignment_id: str) -> None:
    a = await db.get(Assignment, assignment_id)
    if not a:
        raise ApiError(404, "not_found")
    await _teacher_class(db, user, a.class_id)
    await db.delete(a)
    await db.commit()


# ---------------------------------------------------------------- báo cáo

async def _teacher_assignment(db: AsyncSession, user: User, assignment_id: str) -> tuple[Assignment, Classroom]:
    a = await db.get(Assignment, assignment_id)
    if not a:
        raise ApiError(404, "not_found")
    return a, await _teacher_class(db, user, a.class_id)


def _bucket(score: float) -> int:
    return min(int(score // 2), 4)


async def report(db: AsyncSession, user: User, assignment_id: str) -> AssignmentReport:
    a, c = await _teacher_assignment(db, user, assignment_id)
    now = datetime.now(UTC)
    members = list(await db.scalars(select(User).join(ClassMember, ClassMember.user_id == User.id).where(ClassMember.class_id == c.id)))
    by_user = {e.user_id: e for e in await exams.assignment_exams(db, [a.id], [m.id for m in members])}
    done = [by_user[m.id] for m in members if m.id in by_user and by_user[m.id].result]

    students = []
    for m in members:
        e = by_user.get(m.id)
        st = status_of(a, e, now)
        students.append(StudentResult(
            id=m.id, full_name=m.full_name, status=st, exam_id=e.id if e else None, score=_score(e),
            correct=e.result["correct"] if e and e.result else None, total=a.size,
            started_at=e.created_at if e else None, submitted_at=e.submitted_at if e else None,
            duration_seconds=int((e.submitted_at - e.created_at).total_seconds()) if e and e.submitted_at else None,
        ))
    order = {"submitted": 0, "late": 0, "in_progress": 1, "todo": 2, "missed": 3}
    students.sort(key=lambda s: (order[s.status], -(s.score or 0), s.full_name))

    # Điểm từng câu theo vị trí gốc trong bài giao (đề đảo câu thì mã câu của mỗi học sinh khác nhau)
    earned: dict[int, float] = defaultdict(float)
    answered: dict[int, int] = defaultdict(int)
    if done:
        index_of = await exams.source_indexes(db, [e.id for e in done])
        for e in done:
            for item in e.result["items"]:
                i = index_of.get(item["question_id"])
                if i is not None:
                    earned[i] += item["points"]
                    answered[i] += 1

    names = await bank.skill_names(db)
    questions = [
        QuestionStat(index=i, type=q["type"], statement=q["statement"], template=TemplateRef(code=q["template_code"], name=q["template_name"]),
                     skill=SkillOut(code=q["skill_code"], name=names.get(q["skill_code"], q["skill_code"])), answer_display=q["answer_display"],
                     correct_rate=earned[i] / answered[i] if answered[i] else None, answered=answered[i])
        for i, q in enumerate(a.questions, start=1)
    ]
    by_skill: dict[str, list[QuestionStat]] = defaultdict(list)
    for q in questions:
        by_skill[q.skill.code].append(q)
    skills = []
    for qs in by_skill.values():
        total = sum(q.answered for q in qs)
        skills.append(SkillStat(skill=qs[0].skill, questions=len(qs), correct_rate=sum(earned[q.index] for q in qs) / total if total else None))
    skills.sort(key=lambda s: (s.correct_rate is None, s.correct_rate or 0))  # kỹ năng yếu nhất lên đầu

    scores = [e.result["score"] for e in done]
    distribution = [0] * 5
    for s in scores:
        distribution[_bucket(s)] += 1
    summary = ReportSummary(member_count=len(members), submitted_count=len(done), late_count=sum(s.status == "late" for s in students),
                            average_score=_mean(scores), max_score=max(scores, default=None), min_score=min(scores, default=None),
                            distribution=distribution)
    out = _assignment_out(a, c.name, member_count=len(members), submitted_count=len(done), average_score=summary.average_score)
    return AssignmentReport(assignment=out, summary=summary, students=students, questions=questions, skills=skills)


async def submission(db: AsyncSession, user: User, assignment_id: str, student_id: str) -> ExamOut:
    """Giáo viên xem bài làm (đã nộp) của một học sinh: câu hỏi, lựa chọn của học sinh, đáp án và lời giải."""
    a, _ = await _teacher_assignment(db, user, assignment_id)
    exam = await exams.assignment_exam(db, a.id, student_id)
    if not exam or exam.result is None:
        raise ApiError(404, "not_found")
    return await exams.detail(db, exam)


# ---------------------------------------------------------------- bảng xếp hạng

async def leaderboard(db: AsyncSession, user: User, class_id: str) -> list[LeaderboardRow]:
    c = await _visible_class(db, user, class_id)
    members = list(await db.scalars(select(User).join(ClassMember, ClassMember.user_id == User.id).where(ClassMember.class_id == c.id)))
    ids = [m.id for m in members]
    if not ids:
        return []
    scores: dict[str, list[float]] = defaultdict(list)
    assignment_ids = list(await db.scalars(select(Assignment.id).where(Assignment.class_id == c.id)))
    for e in await exams.assignment_exams(db, assignment_ids, ids, submitted=True):
        scores[e.user_id].append(e.result["score"])

    today = learning.today_vn()
    days = await learning.activity_by_user(db, ids, STREAK_WINDOW_DAYS)
    streaks = await learning.streaks_by_user(db, days)
    rows = [
        LeaderboardRow(id=m.id, full_name=m.full_name, is_me=m.id == user.id, average_score=_mean(scores[m.id]),
                       assignments_done=len(scores[m.id]),
                       week_problems=sum(n for d, n in days[m.id].items() if d > today - timedelta(days=7)),
                       streak_days=streaks[m.id])
        for m in members
    ]
    rows.sort(key=lambda r: (r.average_score is None, -(r.average_score or 0), -r.week_problems, r.full_name))
    return rows
