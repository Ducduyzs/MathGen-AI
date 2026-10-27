"""Bậc rank Đấu trường: Đồng → Bạc → Vàng → Bạch kim → Kim cương (mỗi bậc 3 hạng III, II, I) → Cao thủ.

Mỗi lượt có ít nhất MIN_ANSWERED câu được tính rank: so điểm/phút với mức chuẩn của bậc hiện tại (bậc càng cao, chuẩn càng cao),
lượt dài hơn tính nặng hơn. Điểm rank không xuống dưới 0.
"""

import math

from app.modules.arena.schemas import RankOut

TIERS: tuple[tuple[str, str, int], ...] = (
    ("bronze", "Đồng", 0),
    ("silver", "Bạc", 400),
    ("gold", "Vàng", 900),
    ("platinum", "Bạch kim", 1500),
    ("diamond", "Kim cương", 2200),
    ("master", "Cao thủ", 3000),
)
DIVISIONS = ("III", "II", "I")
MIN_ANSWERED = 3


def target_per_minute(points: int) -> float:
    """Điểm/phút cần đạt để giữ nguyên rank: Đồng ~20, Cao thủ ~70."""
    return 20 + points / 60


def rank_delta(points: int, score: int, answered: int, duration_minutes: int) -> int | None:
    """Điểm rank cộng/trừ sau một lượt; None nếu lượt quá ít câu để tính."""
    if answered < MIN_ANSWERED:
        return None
    weight = math.sqrt(duration_minutes / 5)  # lượt 30 phút nặng gấp ~2,4 lần lượt 5 phút
    raw = (score / duration_minutes - target_per_minute(points)) * 1.2 * weight
    return max(-round(25 * weight), min(round(40 * weight), round(raw)))


def describe(points: int, ranked_runs: int = 0) -> RankOut:
    i = max(k for k, (_, _, start) in enumerate(TIERS) if points >= start)
    code, name, start = TIERS[i]
    if i == len(TIERS) - 1:
        return RankOut(points=points, tier=code, tier_name=name, division=None, label=name, floor=start, next_at=None,
                       ranked_runs=ranked_runs)
    end = TIERS[i + 1][2]
    size = (end - start) / 3
    d = min(2, int((points - start) // size))
    return RankOut(points=points, tier=code, tier_name=name, division=DIVISIONS[d], label=f"{name} {DIVISIONS[d]}",
                   floor=round(start + d * size), next_at=round(start + (d + 1) * size), ranked_runs=ranked_runs)
