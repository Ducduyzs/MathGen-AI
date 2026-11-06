"""Tính lại mã băm dạng chuẩn sau khi khóa phân biệt cách hỏi, rồi khôi phục các bài từng bị từ chối oan vì trùng.

Chạy từ apps/api: PYTHONPATH=. .venv/Scripts/python scripts/rehash_canonical.py [--apply]
Mặc định chỉ đọc. --apply lưu mã băm cũ vào var/llm_review/hash_backup.json trước khi ghi.
Bài khôi phục là bài cả hai mô hình đã duyệt (var/llm_review/rejected_duplicates.json) và nay không còn trùng.
"""

import argparse
import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select, update

import app.main  # noqa: F401  (nạp mọi model để SQLAlchemy nhận đủ khóa ngoại khi ghi)
from app.core.db import SessionLocal, engine
from app.core.errors import ApiError
from app.modules.ingestion.models import GeneratedVariant
from app.modules.ingestion.pipeline import hash_key, problem_key
from app.modules.problem_bank import service
from app.modules.problem_bank.models import Problem, ReviewItem

OUT = Path(__file__).resolve().parents[1] / "var" / "llm_review"
REASON = "Trùng bài trong ngân hàng"
TAG = "[AI gpt-5.2 + deepseek-v4-pro] Hai mô hình cùng tự giải và xác nhận đạt"


def new_hash(statement: str) -> str | None:
    key = problem_key(statement)
    return hash_key(key) if key else None


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    async with SessionLocal() as db:
        problems = (await db.execute(select(Problem.id, Problem.statement, Problem.canonical_hash).order_by(Problem.canonical_hash.is_(None), Problem.id))).all()
        reviews = (await db.execute(select(ReviewItem.id, ReviewItem.statement, ReviewItem.canonical_hash))).all()
        variants = (await db.execute(select(GeneratedVariant.id, GeneratedVariant.payload, GeneratedVariant.canonical_hash))).all()

    # Ngân hàng có ràng buộc unique: bài đã có mã băm được ưu tiên giữ, bài sau cùng khóa để trống như lúc seed
    plan: dict[str, str | None] = {}
    taken: set[str] = set()
    lost = []
    for pid, statement, old in problems:
        h = new_hash(statement) or old
        if h in taken:
            if old:
                lost.append(pid)
            h = None
        if h:
            taken.add(h)
        plan[pid] = h
    old_by_id = {i: o for i, _, o in problems}
    changed = {k: v for k, v in plan.items() if v != old_by_id[k]}
    review_plan = {i: h for i, s, o in reviews if (h := new_hash(s)) and h != o}
    variant_plan = {i: h for i, p, o in variants if (h := new_hash(p.get("statement", ""))) and h != o}

    rejected = json.loads((OUT / "rejected_duplicates.json").read_text(encoding="utf8"))
    restore = [r for r in rejected if new_hash(r["statement"]) not in taken]
    still = [r for r in rejected if new_hash(r["statement"]) in taken]
    print(f"Ngân hàng {len(problems)}: đổi {len(changed)} mã băm (điền mới {sum(old_by_id[k] is None for k in changed)}, mất {len(lost)})")
    print(f"Hàng chờ/lịch sử: đổi {len(review_plan)}; biến thể đã sinh: đổi {len(variant_plan)}")
    print(f"51 bài đã từ chối: khôi phục được {len(restore)}, vẫn trùng {len(still)}")
    for r in still:
        print("  vẫn trùng:", r["statement"][:80], "||", r["bank"][:70])
    if lost:
        print("  mất mã băm:", lost[:10])
    if not a.apply:
        print("Chế độ chỉ đọc: chưa ghi gì.")
        await engine.dispose()
        return

    (OUT / "hash_backup.json").write_text(json.dumps({
        "at": datetime.now(UTC).isoformat(), "problems": old_by_id, "reviews": {i: o for i, _, o in reviews}, "variants": {i: o for i, _, o in variants},
    }, ensure_ascii=False), encoding="utf8")
    async with SessionLocal() as db:
        # Hai pha để không vướng unique khi bài A nhận mã băm cũ của bài B
        await db.execute(update(Problem).where(Problem.id.in_(list(changed))).values(canonical_hash=None))
        await db.flush()
        for table, rows in ((Problem, changed), (ReviewItem, review_plan), (GeneratedVariant, variant_plan)):
            for i, h in rows.items():
                if h is not None:
                    await db.execute(update(table).where(table.id == i).values(canonical_hash=h))
        await db.commit()
    print("Đã ghi mã băm mới.")

    restored, failed = 0, 0
    async with SessionLocal() as db:
        for r in restore:
            item = await db.get(ReviewItem, r["id"], with_for_update=True)
            if not item or item.status != "rejected" or item.reason != REASON:
                failed += 1
                await db.rollback()
                continue
            item.status, item.decided_at, item.reason = "pending", None, None
            await db.commit()
            try:
                await service.decide(db, r["id"], "approve", TAG, None)
                restored += 1
            except ApiError as e:  # hai bài khôi phục trùng nhau: bài sau trở lại trạng thái từ chối
                await db.rollback()
                await service.decide(db, r["id"], "reject", REASON, None)
                failed += 1
                print(f"  giữ từ chối {r['id']}: {e.code}")
    print(f"Đã khôi phục {restored}, giữ từ chối thêm {failed}.")
    await engine.dispose()


asyncio.run(main())
