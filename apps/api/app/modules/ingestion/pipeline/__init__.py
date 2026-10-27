"""Pipeline: văn bản đề → tách câu → nhận dạng cấu trúc → giải & kiểm chứng → chống trùng.

Bản Python của apps/web/src/mocks/pipeline (cùng thuật toán, cùng khóa chuẩn). Số học dùng phân số chính xác;
SymPy chỉ dùng để kiểm chứng độc lập trong worker (sympy_check.py).
"""

from app.modules.ingestion.pipeline.canonical import canonical_key, canonical_latex, estimate_difficulty, hash_key
from app.modules.ingestion.pipeline.generate import RULES, generate_variants, rules_for
from app.modules.ingestion.pipeline.parse import ParseError, parse_relation
from app.modules.ingestion.pipeline.poly import coef, const_of, deg_m, deg_x, is_const, plain
from app.modules.ingestion.pipeline.solve import Solved, SolveError, solve
from app.modules.ingestion.pipeline.split import split_questions
from app.modules.ingestion.pipeline.structure import (
    FLIP, KIND_LABEL, KIND_SKILL, Structure, general_form, math_segments, recognize, to_display,
)


def match_choice(choices: list[dict], solved: Solved) -> str | None:
    """Phương án A/B/C/D nào khớp lời giải: so đáp số, hoặc so bất đẳng thức một biến (x > 4, m < 25/4)."""
    for c in choices:
        segs = math_segments(c["content"])
        seg = segs[0] if segs else c["content"]
        try:
            P, rel = parse_relation(seg)
        except ParseError:
            continue  # phương án không phải biểu thức
        if not rel:
            if solved.short is not None and is_const(P) and const_of(P) == solved.short:
                return c["key"]
            continue
        # Một biến (x hoặc m), bậc nhất: v rel giá trị
        v = "m" if deg_m(P) else "x"
        if deg_x(P) + deg_m(P) != 1:
            continue
        k = coef(P, 0, 1) if v == "m" else coef(P, 1)
        value = -coef(P, 0) / k
        r = FLIP[rel] if k < 0 else rel
        if r == "=" and solved.short is not None and value == solved.short:
            return c["key"]
        if solved.key == f"{v}{r}{plain(value)}":
            return c["key"]
    return None


def problem_key(statement: str) -> str | None:
    """Khóa chuẩn của một đề (None nếu không nhận dạng được) — dùng cho chỉ mục chống trùng của ngân hàng."""
    rec = recognize(statement)
    return canonical_key(rec.structure) if rec.ok else None


def run_pipeline(text: str, source_id: str, bank: dict[str, str], skill_names: dict[str, str]) -> list[dict]:
    """`bank`: mã băm dạng chuẩn → mã bài trong ngân hàng. Mỗi câu → dict theo hợp đồng ExtractedItem của frontend, kèm `_structure` và `_key` (nội bộ, không trả ra API)."""
    seen: dict[str, str] = {}
    out = []
    for rq in split_questions(text):
        base = {
            "id": f"{source_id}_c{rq.index}", "index": rq.index, "raw_text": rq.raw, "statement": to_display(rq.stem),
            "choices": rq.choices, "status": "unrecognized", "reason": None, "structure": None, "answer_display": None,
            "solution": [], "grade": None, "skill": None, "difficulty": None, "confidence": 0.0, "checks": [],
            "duplicate_of": None, "matched_choice": None, "rules": [], "_structure": None, "_key": None, "_short": None, "_short_label": None,
        }
        rec = recognize(rq.stem)
        if not rec.ok:
            out.append(base | {"reason": rec.reason})
            continue
        s = rec.structure
        try:
            solved = solve(s)
        except (SolveError, ZeroDivisionError) as e:
            out.append(base | {"reason": f"Nhận ra dạng {KIND_LABEL[s.kind].lower()} nhưng chưa giải được: {e}."})
            continue

        key = canonical_key(s)
        bank_dup, inner_dup = bank.get(hash_key(key)), seen.get(key)
        if not inner_dup:
            seen[key] = f"Câu {rq.index}"
        matched = match_choice(rq.choices, solved) if rq.choices else None
        template, params = general_form(s)
        skill, grade = KIND_SKILL[s.kind]
        checks = [
            {"label": "Đọc được biểu thức và nhận dạng dạng bài", "passed": True},
            *solved.checks,
            *([{"label": f"Lời giải khớp phương án {matched} trong đề" if matched else "Không phương án nào khớp lời giải — kiểm tra lại đề",
                "passed": bool(matched)}] if rq.choices else []),
            {"label": f"Trùng bài {bank_dup} trong ngân hàng" if bank_dup else "Không trùng ngân hàng bài", "passed": not bank_dup},
            *([{"label": f"Trùng với {inner_dup} trong cùng đề", "passed": False}] if inner_dup else []),
        ]
        out.append(base | {
            "status": "recognized",
            "structure": {"kind": s.kind, "kind_label": KIND_LABEL[s.kind], "general_form": template, "params": params,
                          "canonical": canonical_latex(s), "hash": hash_key(key)},
            "answer_display": solved.display, "solution": solved.steps, "grade": grade,
            "skill": {"code": skill, "name": skill_names.get(skill, skill)}, "difficulty": estimate_difficulty(s),
            "confidence": rec.confidence, "checks": checks, "duplicate_of": bank_dup or inner_dup, "matched_choice": matched,
            "rules": rules_for(s.kind), "_structure": s.to_json(), "_key": key,
            # Đáp số một số (nếu có) để bài trích từ đề thật chấm tự động được khi vào ngân hàng
            "_short": plain(solved.short) if solved.short is not None else None, "_short_label": solved.short_label,
        })
    return out


__all__ = [
    "RULES", "Structure", "canonical_key", "generate_variants", "hash_key", "match_choice", "problem_key",
    "run_pipeline", "solve",
]
