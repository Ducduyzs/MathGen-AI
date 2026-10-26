// Tách văn bản đề thành từng câu, và tách phương án A/B/C/D khỏi phần đề.
import type { Choice } from "@/types/api";
import { toDisplay } from "./structure";

export interface RawQuestion {
  index: number;
  raw: string;
  stem: string;
  choices: Choice[];
}

/** Sửa lỗi hay gặp khi trích PDF/Word: dấu trừ Unicode, chỉ số trên bị rơi (x2 → x^2), khoảng trắng thừa. */
export function normalizeExtracted(text: string) {
  let t = text.replace(/\r\n?/g, "\n").replace(/ /g, " ").replace(/[ \t]+/g, " ");
  // "x2 - 5x" do mất định dạng chỉ số trên. Không áp dụng khi đề nói về x1, x2 (nghiệm Vi-ét).
  if (!/x\s*_?\s*1\b/.test(t)) t = t.replace(/\b([xm])([23])(?=\s*[-+−–=<>≤≥)]|\s*$)/gm, "$1^$2");
  return t.trim();
}

const QUESTION_MARK = /(?:^|\n)\s*(?:Câu|Bài|Question)\s*(\d+)\s*[.:)]\s*/gi;
const NUMBER_MARK = /(?:^|\n)\s*(\d{1,3})\s*[.)]\s+/g;

export function splitQuestions(text: string): RawQuestion[] {
  const t = normalizeExtracted(text);
  let marks = [...t.matchAll(QUESTION_MARK)];
  if (marks.length === 0) marks = [...t.matchAll(NUMBER_MARK)];

  const bodies: string[] = marks.length
    ? marks.map((m, i) => t.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim())
    : // Không có đánh số: mỗi đoạn có công thức là một câu.
      t.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => /[=<>≤≥]|\$/.test(p));

  return bodies
    .filter(Boolean)
    .map((body, i) => {
      const { stem, choices } = splitChoices(body);
      return { index: i + 1, raw: body, stem, choices };
    });
}

/** "… là A. x = 2 B. x = 3 C. … D. …" → phần đề + 4 phương án. */
function splitChoices(body: string): { stem: string; choices: Choice[] } {
  const marks = [...body.matchAll(/(?:^|\s)([A-D])\s*[.)]\s+/g)];
  const order = marks.map((m) => m[1]).join("");
  const start = order.indexOf("ABCD");
  if (start < 0) return { stem: body.replace(/\s*\n\s*/g, " "), choices: [] };
  const used = marks.slice(start, start + 4);
  const stem = body.slice(0, used[0].index).replace(/\s*\n\s*/g, " ").trim();
  const choices = used.map((m, i) => {
    const from = m.index! + m[0].length;
    const to = i + 1 < used.length ? used[i + 1].index : undefined;
    return { key: m[1], content: toDisplay(body.slice(from, to).replace(/\s*\n\s*/g, " ").trim()) };
  });
  return { stem, choices };
}
