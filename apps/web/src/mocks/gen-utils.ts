// Hàm dùng chung cho các bộ sinh đề (mock): số ngẫu nhiên, định dạng LaTeX, tạo phương án.
import type { Choice, ExamAnswer, ExamMode, ExamQuestionType, TFStatement } from "@/types/api";

export const r = String.raw;

export const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
export const coin = () => Math.random() < 0.5;

export function nonZero(min: number, max: number) {
  let v = 0;
  while (v === 0) v = rand(min, max);
  return v;
}

export function distinctPair(min: number, max: number, skipZero = false): [number, number] {
  const draw = () => (skipZero ? nonZero(min, max) : rand(min, max));
  const p = draw();
  let q = draw();
  while (q === p) q = draw();
  return p < q ? [p, q] : [q, p];
}

export function shuffle<T>(xs: readonly T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Tổ hợp chập k của n. */
export function C(n: number, k: number) {
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return out;
}

/** Phân số tối giản dạng LaTeX. */
export function frac(n: number, d: number) {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  [n, d] = [n / g, d / g];
  if (d === 1) return `${n}`;
  return n < 0 ? r`-\dfrac{${-n}}{${d}}` : r`\dfrac{${n}}{${d}}`;
}

/** Phân số tối giản dạng "n/d" để chấm (parseNumber hiểu được). */
export function fracValue(n: number, d: number) {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
}

/** Ghép đa thức: poly([[1, "x^2"], [-5, "x"], [6, ""]]) → "x^2 - 5x + 6". */
export function poly(terms: [number, string][]) {
  let out = "";
  for (const [c, v] of terms) {
    if (c === 0) continue;
    const abs = Math.abs(c);
    const body = v ? (abs === 1 ? v : `${abs}${v}`) : `${abs}`;
    out += out ? (c < 0 ? ` - ${body}` : ` + ${body}`) : c < 0 ? `-${body}` : body;
  }
  return out || "0";
}

export const lin = (a: number, b: number) => poly([[a, "x"], [b, ""]]);
export const quad = (b: number, c: number) => poly([[1, "x^2"], [b, "x"], [c, ""]]);
/** (x - root) */
export const factor = (root: number) => `(${poly([[1, "x"], [-root, ""]])})`;
/** Biểu thức số: sum([4, -6, 1]) → "4 - 6 + 1". */
export const sum = (xs: number[]) => xs.map((x, i) => (i === 0 ? `${x}` : x < 0 ? ` - ${-x}` : ` + ${x}`)).join("");
/** Điểm/vectơ: p3(1, -2, 3) → "(1;\ -2;\ 3)". */
export const p3 = (...xs: number[]) => `(${xs.join(r`;\ `)})`;

const KEYS = ["A", "B", "C", "D"];

/** Đáp án đúng + các phương án nhiễu (bỏ trùng), xáo vị trí. */
export function makeChoices(correct: string, candidates: string[]) {
  const wrong = [...new Set(candidates.filter((c) => c !== correct))].slice(0, 3);
  const all = shuffle([correct, ...wrong]);
  const choices: Choice[] = all.map((c, i) => ({ key: KEYS[i], content: `$${c}$` }));
  const key = KEYS[all.indexOf(correct)];
  return { choices, answer: { type: "choice", value: key } as ExamAnswer, answer_display: `${key}. $${correct}$` };
}

/** Câu Đúng/Sai: truth[i] là đáp án của ý thứ i. */
export function tf(statements: string[], truth: boolean[]) {
  const keys = ["a", "b", "c", "d"];
  const list: TFStatement[] = statements.map((content, i) => ({ key: keys[i], content }));
  const value = Object.fromEntries(list.map((s, i) => [s.key, truth[i]]));
  const display = list.map((s, i) => `${s.key}) ${truth[i] ? "Đúng" : "Sai"}`).join(" · ");
  return { statements: list, answer: { type: "true_false", value } as ExamAnswer, answer_display: display };
}

export const number = (value: number | string): ExamAnswer => ({ type: "number", value: String(value) });

export interface Generated {
  statement: string;
  choices?: Choice[];
  statements?: TFStatement[];
  answer_prefix?: string;
  answer: ExamAnswer;
  answer_display: string;
  solution: string[];
  /** Sai số chấp nhận cho câu trả lời ngắn có làm tròn (ví dụ 0,005 khi làm tròn đến hàng phần trăm). */
  tolerance?: number;
}

/** Phần của đề thi tốt nghiệp THPT mà dạng bài thuộc về. */
export type ThptPart = "I" | "II" | "III";

export interface ExamTemplate {
  code: string;
  name: string;
  skill: string;
  grade: number;
  difficulty: number;
  mode: ExamMode;
  type: ExamQuestionType;
  part?: ThptPart;
  make: () => Generated;
}
