"""Bảng chất lượng nội dung cho quản trị viên: gom số liệu từ ngân hàng, hàng chờ duyệt, học tập, pipeline và bộ gom."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.classifier import service as classifier
from app.modules.crawler import service as crawler
from app.modules.ingestion import service as ingestion
from app.modules.learning import service as learning
from app.modules.problem_bank import service as bank
from app.modules.quality.schemas import Count, QualityOut, Reason, SkillCoverage, SuspiciousProblem
from app.modules.regions import service as regions

MIN_PER_SKILL = 10
ORIGIN = {"seed": "Bài mẫu / sinh sẵn", "extracted": "Trích từ đề thật", "generated": "Biến thể AI sinh"}
PAGE = {"fetched": "Có câu hỏi", "unchanged": "Không đổi", "no_questions": "Không có câu", "blocked": "Bị chặn", "error": "Lỗi"}


def _rate(a: int, b: int) -> float | None:
    return a / b if b else None


async def report(db: AsyncSession) -> QualityOut:
    b = await bank.quality_stats(db)
    skills = await bank.skills(db)
    learn = await learning.attempt_stats(db)
    sus = await learning.suspicious_problems(db)
    probs = await bank.problems_by_ids(db, [s["problem_id"] for s in sus])
    names = {s.code: s.name for s in skills}
    ing = await ingestion.quality_stats(db)
    cr = await crawler.quality_stats(db)

    stage = {"primary": 0, "secondary": 0}
    for s in skills:
        stage["primary" if (s.grade_max or 12) <= 5 else "secondary"] += b["by_skill"].get(s.code, 0)
    coverage = sorted(
        (SkillCoverage(code=s.code, name=s.name, grade_min=s.grade_min, grade_max=s.grade_max, problems=b["by_skill"].get(s.code, 0),
                       low=b["by_skill"].get(s.code, 0) < MIN_PER_SKILL) for s in skills),
        key=lambda c: (c.grade_min or 0, c.name),
    )
    decided = b["approved_recent"] + b["rejected_recent"]
    return QualityOut(
        problems_total=b["total"],
        by_origin=[Count(key=k, label=ORIGIN.get(k, k), count=v) for k, v in sorted(b["by_origin"].items(), key=lambda kv: -kv[1])],
        by_stage=[Count(key="primary", label="Tiểu học (lớp 1–5)", count=stage["primary"]),
                  Count(key="secondary", label="Lớp 6–12", count=stage["secondary"])],
        coverage=coverage, min_per_skill=MIN_PER_SKILL,
        by_province=[Count(key=k, label=regions.province_name(k) or k, count=v) for k, v in sorted(b["by_province"].items(), key=lambda kv: -kv[1])],
        pending=b["pending"],
        pending_by_origin=[Count(key=k, label=ORIGIN.get(k, k), count=v) for k, v in b["pending_by_origin"].items()],
        approved_recent=b["approved_recent"], rejected_recent=b["rejected_recent"], approval_rate=_rate(b["approved_recent"], decided),
        reject_reasons=[Reason(**r) for r in b["reject_reasons"]],
        attempts_week=learn["attempts"], correct_rate_week=learn["correct_rate"], active_students_week=learn["active_students"],
        suspicious=[SuspiciousProblem(problem_id=s["problem_id"], statement=probs[s["problem_id"]].statement,
                                      skill=names.get(probs[s["problem_id"]].skill_code, probs[s["problem_id"]].skill_code),
                                      grade=probs[s["problem_id"]].grade, origin=ORIGIN.get(probs[s["problem_id"]].origin, probs[s["problem_id"]].origin),
                                      attempts=s["attempts"], correct_rate=s["correct_rate"])
                    for s in sus if s["problem_id"] in probs],
        documents=ing["documents"], documents_failed=ing["failed"], items=ing["items"], recognized=ing["recognized"], duplicates=ing["duplicates"],
        recognition_rate=_rate(ing["recognized"], ing["items"]), documents_with_region=ing["with_region"],
        crawl_sources=cr["sources"], crawl_active_sources=cr["active_sources"], crawl_jobs=cr["jobs"], crawl_submitted=cr["submitted"],
        crawl_pages=[Count(key=k, label=PAGE.get(k, k), count=v) for k, v in cr["pages"].items()],
        classifier=classifier.status(),
    )
