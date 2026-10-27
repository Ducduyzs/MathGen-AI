"""Tách văn bản đề thành từng câu, và tách phương án A/B/C/D khỏi phần đề (chuyển từ mocks/pipeline/split.ts)."""

import re
from dataclasses import dataclass

from app.modules.ingestion.pipeline.structure import to_display


@dataclass(frozen=True)
class RawQuestion:
    index: int
    raw: str
    stem: str
    choices: list[dict]


def normalize_extracted(text: str) -> str:
    """Sửa lỗi hay gặp khi trích PDF/Word: dấu trừ Unicode, chỉ số trên bị rơi (x2 → x^2), khoảng trắng thừa."""
    t = re.sub(r"\r\n?", "\n", text).replace(" ", " ")
    t = re.sub(r"[ \t]+", " ", t)
    # "x2 - 5x" do mất định dạng chỉ số trên. Không áp dụng khi đề nói về x1, x2 (nghiệm Vi-ét).
    if not re.search(r"x\s*_?\s*1\b", t):
        t = re.sub(r"\b([xm])([23])(?=\s*[-+−–=<>≤≥)]|\s*$)", r"\1^\2", t, flags=re.M)
    return t.strip()


QUESTION_MARK = re.compile(r"(?:^|\n)\s*(?:Câu|Bài|Question)\s*(\d+)\s*[.:)]\s*", re.I)
NUMBER_MARK = re.compile(r"(?:^|\n)\s*(\d{1,3})\s*[.)]\s+")


def _one_line(s: str) -> str:
    return re.sub(r"\s*\n\s*", " ", s).strip()


def split_choices(body: str) -> tuple[str, list[dict]]:
    """"… là A. x = 2 B. x = 3 C. … D. …" → phần đề + 4 phương án."""
    marks = list(re.finditer(r"(?:^|\s)([A-D])\s*[.)]\s+", body))
    order = "".join(m.group(1) for m in marks)
    start = order.find("ABCD")
    if start < 0:
        return _one_line(body), []
    used = marks[start:start + 4]
    stem = _one_line(body[:used[0].start()])
    choices = []
    for i, m in enumerate(used):
        end = used[i + 1].start() if i + 1 < len(used) else len(body)
        choices.append({"key": m.group(1), "content": to_display(_one_line(body[m.end():end]))})
    return stem, choices


def split_questions(text: str) -> list[RawQuestion]:
    t = normalize_extracted(text)
    marks = list(QUESTION_MARK.finditer(t)) or list(NUMBER_MARK.finditer(t))
    if marks:
        bodies = [t[m.end():(marks[i + 1].start() if i + 1 < len(marks) else len(t))].strip() for i, m in enumerate(marks)]
    else:  # không đánh số: mỗi đoạn có công thức là một câu
        bodies = [p.strip() for p in re.split(r"\n\s*\n", t) if re.search(r"[=<>≤≥]|\$", p)]
    out = []
    for body in (b for b in bodies if b):
        stem, choices = split_choices(body)
        out.append(RawQuestion(index=len(out) + 1, raw=body, stem=stem, choices=choices))
    return out
