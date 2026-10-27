"""Nạp dữ liệu mẫu (chạy lại nhiều lần vẫn an toàn).

    python -m app.seed            # kỹ năng + ngân hàng bài + hàng chờ duyệt
    python -m app.seed --demo     # thêm tài khoản thử (mật khẩu 123456) — CHỈ dùng ở dev
"""

import argparse
import asyncio
import json
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import DailyActivity, ParentLink, Problem, ReviewItem, Skill, SkillScore, User
from app.modules.exams.generator import PRIMARY, Rng
from app.modules.ingestion.pipeline import hash_key, problem_key
from app.modules.learning.service import today_vn

DATA = json.loads((Path(__file__).parent / "data.json").read_text(encoding="utf-8"))


def with_hash(problems: list[dict]) -> list[dict]:
    """Mã băm dạng chuẩn (chống trùng khi tải đề / sinh biến thể). Bài không nhận dạng được hoặc trùng bài trước thì để trống."""
    seen: set[str] = set()
    out = []
    for p in problems:
        key = problem_key(p["statement"])
        h = hash_key(key) if key else None
        out.append({**p, "canonical_hash": h if h not in seen else None})
        seen.add(h)
    return out


PER_TEMPLATE = 10


def primary_problems() -> list[dict]:
    """Bài tiểu học cho ngân hàng (luyện tập): mỗi dạng lớp 1–5 sinh PER_TEMPLATE bài.

    Hạt giống cố định theo mã dạng nên chạy lại seed ra đúng các bài cũ (id ổn định, ghi đè được).
    """
    out = []
    for t in PRIMARY:
        g, seen = Rng(f"seed:{t.code}"), set()
        while len(seen) < PER_TEMPLATE:
            q = t.make(g)
            key = q["statement"] + json.dumps(q.get("choices"), ensure_ascii=False)  # cùng đề bài, khác phương án vẫn là bài khác
            if key in seen:
                continue
            seen.add(key)
            out.append({
                "id": f"g_{t.code}_{len(seen):02d}", "statement": q["statement"], "grade": t.grade, "skill_code": t.skill,
                "difficulty": t.difficulty, "answer_type": q["answer"]["type"], "answer_prefix": q.get("answer_prefix"),
                "choices": q.get("choices"), "hints": None, "answer": q["answer"], "answer_display": q["answer_display"],
                "solution": q["solution"], "canonical_hash": None,
            })
    return out


async def seed(db: AsyncSession, demo: bool) -> dict:
    skill = insert(Skill).values(DATA["skills"])
    await db.execute(skill.on_conflict_do_update(index_elements=["code"], set_={c: skill.excluded[c] for c in ("name", "sort", "grade_min", "grade_max")}))
    problems = [*with_hash(DATA["problems"]), *primary_problems()]
    stmt = insert(Problem).values([{**p, "status": "approved", "origin": "seed"} for p in problems])
    cols = ("statement", "grade", "skill_code", "difficulty", "answer_type", "answer_prefix", "choices", "hints", "answer", "answer_display", "solution", "canonical_hash")
    await db.execute(stmt.on_conflict_do_update(index_elements=["id"], set_={c: stmt.excluded[c] for c in cols}))
    # INSERT nhiều dòng cần mọi dòng cùng tập cột: điền None cho trường tùy chọn (parent / source / transform / choices).
    optional = {"parent": None, "source": None, "transform": None, "choices": None}
    await db.execute(insert(ReviewItem).values([{**optional, **r, "status": "pending"} for r in DATA["review_items"]]).on_conflict_do_nothing())

    users = 0
    if demo:
        if get_settings().env == "prod":
            raise SystemExit("Không seed tài khoản thử trên production")
        for u in DATA["demo_users"]:
            existing = await db.scalar(select(User).where(User.email == u["email"]))
            if existing:
                continue
            user = User(email=u["email"], password_hash=hash_password(u["password"]), full_name=u["full_name"], role=u["role"], grade=u["grade"])
            db.add(user)
            await db.flush()
            users += 1
            if u["role"] == "student":
                # Hồ sơ năng lực và chuỗi ngày học ban đầu giống mock để giao diện có dữ liệu để xem.
                for code, v in DATA["demo_scores"].items():
                    db.add(SkillScore(user_id=user.id, skill_code=code, score=v["score"], n_attempts=v["n"]))
                d = DATA["demo_daily"]
                today = today_vn()
                db.add(DailyActivity(user_id=user.id, day=today, count=d["count"]))
                for i in range(1, d["streakBefore"] + 1):
                    db.add(DailyActivity(user_id=user.id, day=today - timedelta(days=i), count=d["goal"]))
        # Phụ huynh mẫu theo dõi sẵn học sinh mẫu
        email_of = {u["key"]: u["email"] for u in DATA["demo_users"]}
        for u in DATA["demo_users"]:
            if u.get("parent_of"):
                parent = await db.scalar(select(User.id).where(User.email == u["email"]))
                child = await db.scalar(select(User.id).where(User.email == email_of[u["parent_of"]]))
                await db.execute(insert(ParentLink).values(parent_id=parent, student_id=child).on_conflict_do_nothing())
    await db.commit()
    return {"skills": len(DATA["skills"]), "problems": len(problems), "review_items": len(DATA["review_items"]), "new_demo_users": users}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()
    async with SessionLocal() as db:
        print(await seed(db, args.demo))


if __name__ == "__main__":
    asyncio.run(main())
