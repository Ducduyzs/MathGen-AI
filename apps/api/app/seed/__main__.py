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
from app.models import DailyActivity, Problem, ReviewItem, Skill, SkillScore, User
from app.modules.learning.service import today_vn

DATA = json.loads((Path(__file__).parent / "data.json").read_text(encoding="utf-8"))


async def seed(db: AsyncSession, demo: bool) -> dict:
    await db.execute(insert(Skill).values(DATA["skills"]).on_conflict_do_update(index_elements=["code"], set_={"name": insert(Skill).excluded.name, "sort": insert(Skill).excluded.sort}))
    stmt = insert(Problem).values([{**p, "status": "approved", "origin": "seed"} for p in DATA["problems"]])
    await db.execute(stmt.on_conflict_do_update(index_elements=["id"], set_={c: stmt.excluded[c] for c in ("statement", "grade", "skill_code", "difficulty", "answer_type", "answer_prefix", "choices", "hints", "answer", "answer_display", "solution")}))
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
    await db.commit()
    return {"skills": len(DATA["skills"]), "problems": len(DATA["problems"]), "review_items": len(DATA["review_items"]), "new_demo_users": users}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()
    async with SessionLocal() as db:
        print(await seed(db, args.demo))


if __name__ == "__main__":
    asyncio.run(main())
