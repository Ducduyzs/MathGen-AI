// Sinh biến thể theo luật biến đổi trên cấu trúc (không phải sửa chữ):
//   ax² + bx + c = 0 → đổi hệ số giữ nghiệm nguyên, cho c = 0, cho b = 0, thay c bằng tham số m, …
// Mỗi biến thể phải qua: kiểm chứng ngược (đọc lại đề → nhận dạng → giải lại), tự kiểm của bộ giải,
// và chống trùng với đề gốc, ngân hàng và các biến thể cùng lô.
import type { Choice, VerificationCheck } from "@/types/api";
import { distinctPair, lin, nonZero, pick, rand, shuffle } from "../gen-utils";
import { canonicalKey, estimateDifficulty } from "./canonical";
import { parseRelation, type Rel } from "./parse";
import { addP, coeffsX, degX, fromCoeffs, mulP, scaleP, varP } from "./poly";
import { plain, q, toNumber } from "./rational";
import { nearMisses, solve, type Solved } from "./solve";
import { type Cond, COND_TEXT, type Kind, type Presentation, recognize, render, type Structure } from "./structure";

export type Target = "easier" | "same" | "harder";
export type Format = "original" | "choice" | "short";

interface Ranges {
  leads: number[];
  root: number;
  coef: number;
}

interface Draft {
  structure: Structure;
  pres?: Presentation;
  transform: string;
}

export interface RuleDef {
  code: string;
  label: string;
  description: string;
  kinds: Kind[];
  make: (src: Structure, r: Ranges) => Draft | null;
}

const RELS: Rel[] = ["<", ">", "<=", ">="];
const COMPLEMENT: Record<Rel, Rel> = { "=": "=", "<": ">=", ">": "<=", "<=": ">", ">=": "<" };
const fromRoots = (a: number, p: number, r: number) => fromCoeffs([q(a), q(-a * (p + r)), q(a * p * r)]);
const linearFrom = (lhs: string, rhs: string, kind: Kind, rel: Rel = "="): Draft["structure"] => ({
  kind,
  P: parseRelation(`${lhs} ${rel === "<=" ? "\\le" : rel === ">=" ? "\\ge" : rel} ${rhs}`).P,
  rel,
  ask: "solve",
});

function ranges(src: Structure, target: Target): Ranges {
  if (target === "easier") return { leads: [1], root: 5, coef: 9 };
  if (target === "harder") return { leads: [2, 3, -2, -1], root: 12, coef: 20 };
  const lead = toNumber(coeffsX(src.P)[0] ?? q(1));
  return { leads: Number.isInteger(lead) && lead !== 0 && Math.abs(lead) <= 5 ? [lead] : [1], root: 8, coef: 12 };
}

export const RULES: RuleDef[] = [
  // ---------------- Phương trình bậc nhất
  {
    code: "doi_he_so", label: "Đổi hệ số", description: "Giữ dạng ax + b = c, chọn hệ số và nghiệm nguyên mới.", kinds: ["linear_equation"],
    make: (_s, r) => {
      const a = r.leads[0] === 1 ? rand(2, 5) : rand(2, 9), x0 = rand(-r.root, r.root), b = nonZero(-r.coef, r.coef);
      const lhs = lin(a, b), rhs = `${a * x0 + b}`;
      return { structure: linearFrom(lhs, rhs, "linear_equation"), pres: { lhs, rhs }, transform: `Đổi hệ số: $a = ${a}$, $b = ${b}$, nghiệm mới $x = ${x0}$` };
    },
  },
  {
    code: "hai_ve", label: "Ẩn ở hai vế", description: "Dạng a₁x + b₁ = a₂x + b₂, phải chuyển vế.", kinds: ["linear_equation"],
    make: (_s, r) => {
      const [a2, a1] = distinctPair(1, 9), x0 = rand(-r.root, r.root), b2 = nonZero(-r.coef, r.coef), b1 = (a2 - a1) * x0 + b2;
      const lhs = lin(a1, b1), rhs = lin(a2, b2);
      return { structure: linearFrom(lhs, rhs, "linear_equation"), pres: { lhs, rhs }, transform: `Đưa ẩn về hai vế, nghiệm $x = ${x0}$` };
    },
  },
  {
    code: "dat_ngoac", label: "Có dấu ngoặc", description: "Dạng k(x − p) = ax + b, phải phá ngoặc.", kinds: ["linear_equation"],
    make: (_s, r) => {
      const k = rand(2, 6), p = nonZero(-6, 6), a = rand(1, k - 1), x0 = rand(-r.root, r.root), b = (k - a) * x0 - k * p;
      const lhs = `${k}(${lin(1, -p)})`, rhs = lin(a, b);
      return { structure: linearFrom(lhs, rhs, "linear_equation"), pres: { lhs, rhs }, transform: `Thêm ngoặc $${k}(x - p)$, nghiệm $x = ${x0}$` };
    },
  },
  {
    code: "phan_so", label: "Chứa phân số", description: "Dạng (x + p)/m = (x + q)/n, phải quy đồng (khó hơn).", kinds: ["linear_equation"],
    make: (_s, r) => {
      const [m, n] = shuffle([2, 3, 4, 5, 6]).slice(0, 2), k = nonZero(-5, 5), x0 = rand(-r.root, r.root);
      const lhs = `\\dfrac{${lin(1, m * k - x0)}}{${m}}`, rhs = `\\dfrac{${lin(1, n * k - x0)}}{${n}}`;
      return { structure: linearFrom(lhs, rhs, "linear_equation"), pres: { lhs, rhs }, transform: `Chuyển sang dạng phân số với mẫu $${m}$ và $${n}$, nghiệm $x = ${x0}$` };
    },
  },

  // ---------------- Phương trình bậc hai
  {
    code: "doi_he_so", label: "Đổi hệ số, giữ nghiệm nguyên", description: "Chọn hai nghiệm nguyên mới rồi khai triển a(x − x₁)(x − x₂).", kinds: ["quadratic_equation"],
    make: (_s, r) => {
      const a = pick(r.leads), [p, t] = distinctPair(-r.root, r.root);
      return { structure: { kind: "quadratic_equation", P: fromRoots(a, p, t), rel: "=", ask: "solve" }, transform: `Chọn nghiệm $${p}$ và $${t}$, hệ số $a = ${a}$, khai triển $a(x - x_1)(x - x_2)$` };
    },
  },
  {
    code: "c_bang_0", label: "Cho c = 0", description: "ax² + bx = 0: một nghiệm bằng 0, đặt nhân tử chung.", kinds: ["quadratic_equation"],
    make: (_s, r) => {
      const a = pick(r.leads), x1 = nonZero(-r.root, r.root);
      return { structure: { kind: "quadratic_equation", P: fromRoots(a, 0, x1), rel: "=", ask: "solve" }, transform: `Cho $c = 0$: phương trình $ax^2 + bx = 0$ có nghiệm $0$ và $${x1}$` };
    },
  },
  {
    code: "b_bang_0", label: "Cho b = 0", description: "ax² + c = 0: hai nghiệm đối nhau.", kinds: ["quadratic_equation"],
    make: (_s, r) => {
      const a = pick(r.leads), k = rand(1, r.root);
      return { structure: { kind: "quadratic_equation", P: fromRoots(a, -k, k), rel: "=", ask: "solve" }, transform: `Cho $b = 0$: phương trình $ax^2 + c = 0$ có hai nghiệm $\\pm ${k}$` };
    },
  },
  {
    code: "them_tham_so", label: "Thêm tham số m", description: "Thay hệ số tự do bằng m, hỏi điều kiện về nghiệm.", kinds: ["quadratic_equation", "quadratic_param"],
    make: (_s, r) => {
      const a = pick(r.leads), b = nonZero(-r.coef, r.coef), cond = pick<Cond>(["distinct", "double", "none", "some"]);
      const P = addP(fromCoeffs([q(a), q(b), q(0)]), varP("m"));
      return { structure: { kind: "quadratic_param", P, rel: "=", cond, ask: "solve" }, transform: `Thay $c$ bằng tham số $m$, hỏi điều kiện để phương trình ${COND_TEXT[cond]}` };
    },
  },
  {
    code: "nhan_he_so", label: "Nhân hai vế với một số", description: "Bài tương đương với bài gốc, dùng để kiểm tra bộ chống trùng (sẽ bị loại).", kinds: ["quadratic_equation", "linear_equation"],
    make: (s) => {
      const k = pick([2, 3, -2]);
      return { structure: { ...s, P: scaleP(s.P, q(k)), ask: "solve" }, transform: `Nhân hai vế với $${k}$ (bài tương đương)` };
    },
  },

  // ---------------- Phương trình chứa tham số
  {
    code: "doi_dieu_kien", label: "Đổi yêu cầu về nghiệm", description: "Giữ phương trình, đổi giữa hai nghiệm phân biệt / nghiệm kép / vô nghiệm / có nghiệm.", kinds: ["quadratic_param"],
    make: (s) => {
      const cond = pick((["distinct", "double", "none", "some"] as Cond[]).filter((c) => c !== s.cond));
      return { structure: { ...s, cond, ask: "solve" }, transform: `Đổi yêu cầu thành: phương trình ${COND_TEXT[cond]}` };
    },
  },

  // ---------------- Bất phương trình bậc nhất
  {
    code: "doi_he_so", label: "Đổi hệ số", description: "Hệ số dương, nghiệm biên nguyên mới, chiều bất đẳng thức ngẫu nhiên.", kinds: ["linear_inequality"],
    make: (_s, r) => {
      const a = rand(2, r.leads[0] === 1 ? 5 : 9), x0 = rand(-r.root, r.root), b = nonZero(-r.coef, r.coef), rel = pick(RELS);
      const lhs = lin(a, b), rhs = `${a * x0 + b}`;
      return { structure: linearFrom(lhs, rhs, "linear_inequality", rel), pres: { lhs, rhs }, transform: `Đổi hệ số $a = ${a}$, biên $x = ${x0}$` };
    },
  },
  {
    code: "he_so_am", label: "Hệ số âm (đổi chiều)", description: "Hệ số của x âm: học sinh phải nhớ đổi chiều khi chia.", kinds: ["linear_inequality"],
    make: (_s, r) => {
      const a = -rand(2, 9), x0 = rand(-r.root, r.root), b = nonZero(-r.coef, r.coef), rel = pick(RELS);
      const lhs = lin(a, b), rhs = `${a * x0 + b}`;
      return { structure: linearFrom(lhs, rhs, "linear_inequality", rel), pres: { lhs, rhs }, transform: `Hệ số $a = ${a} < 0$, biên $x = ${x0}$` };
    },
  },

  // ---------------- Bất phương trình bậc hai
  {
    code: "doi_he_so", label: "Đổi hệ số, giữ nghiệm nguyên", description: "Tam thức mới có hai nghiệm nguyên, chiều ngẫu nhiên.", kinds: ["quadratic_inequality"],
    make: (s, r) => {
      const sameSign = toNumber(coeffsX(s.P)[0]) < 0 ? -1 : 1;
      const a = Math.abs(pick(r.leads)) * sameSign, [p, t] = distinctPair(-r.root, r.root);
      return { structure: { kind: "quadratic_inequality", P: fromRoots(a, p, t), rel: pick(RELS), ask: "solve" }, transform: `Tam thức có nghiệm $${p}$ và $${t}$, hệ số $a = ${a}$` };
    },
  },
  {
    code: "doi_chieu", label: "Đổi chiều (lấy phần bù)", description: "Giữ tam thức, đổi dấu so sánh: tập nghiệm thành phần bù.", kinds: ["quadratic_inequality", "linear_inequality"],
    make: (s) => ({ structure: { ...s, rel: COMPLEMENT[s.rel!], ask: "solve" }, transform: "Đổi chiều bất phương trình: tập nghiệm mới là phần bù của tập cũ" }),
  },

  // ---------------- Phân tích nhân tử
  {
    code: "doi_he_so", label: "Đổi hệ số", description: "Tam thức mới có nghiệm hữu tỉ; độ khó cao thì hệ số đầu khác 1.", kinds: ["factorization"],
    make: (_s, r) => {
      const a = Math.abs(pick(r.leads)), p = nonZero(-r.root, r.root);
      // (a·x − n)(x − p): nghiệm n/a hữu tỉ khi a ≠ 1
      let n = nonZero(-r.root, r.root);
      if (a === 1 && n === p) n = p + 1;
      const P = mulP(fromCoeffs([q(a), q(-n)]), fromCoeffs([q(1), q(-p)]));
      return { structure: { kind: "factorization", P, ask: "solve" }, transform: a === 1 ? `Tam thức có nghiệm $${n}$ và $${p}$` : `Tam thức có nghiệm $\\dfrac{${n}}{${a}}$ và $${p}$` };
    },
  },
  {
    code: "hang_dang_thuc", label: "Hằng đẳng thức", description: "Dạng a² − b² hoặc (a − b)².", kinds: ["factorization"],
    make: (_s, r) => {
      const k = rand(2, Math.max(3, r.root));
      const square = Math.random() < 0.5;
      const P = square ? fromRoots(1, k, k) : fromRoots(1, -k, k);
      return { structure: { kind: "factorization", P, ask: "solve" }, transform: square ? `Bình phương của hiệu $(x - ${k})^2$` : `Hiệu hai bình phương $x^2 - ${k}^2$` };
    },
  },
  {
    code: "nhan_tu_chung", label: "Đặt nhân tử chung", description: "Đa thức bậc ba có nhân tử chung x.", kinds: ["factorization"],
    make: (_s, r) => {
      const [p, t] = distinctPair(-r.root, r.root, true);
      return { structure: { kind: "factorization", P: mulP(varP("x"), fromRoots(1, p, t)), ask: "solve" }, transform: `Bậc ba $x(x - ${p})(x - ${t})$ khai triển` };
    },
  },

  // ---------------- Hàm số
  {
    code: "doi_he_so", label: "Đổi hệ số", description: "Hàm số cùng bậc với hệ số mới, điểm tính mới.", kinds: ["function_value"],
    make: (s, r) => {
      const t = nonZero(-4, 4);
      const P = degX(s.P) === 1 ? fromCoeffs([q(nonZero(-r.coef, r.coef)), q(rand(-r.coef, r.coef))]) : fromCoeffs([q(pick(r.leads)), q(rand(-9, 9)), q(rand(-9, 9))]);
      return { structure: { kind: "function_value", P, t: q(t), ask: "solve" }, transform: `Đổi hệ số hàm số, tính tại $x = ${t}$` };
    },
  },
  {
    code: "doi_diem", label: "Đổi điểm cần tính", description: "Giữ hàm số, tính giá trị tại điểm khác.", kinds: ["function_value"],
    make: (s) => {
      let t = nonZero(-5, 5);
      if (s.t && t === toNumber(s.t)) t += 1;
      return { structure: { ...s, t: q(t), ask: "solve" }, transform: `Giữ hàm số, tính tại $x = ${t}$` };
    },
  },
  {
    code: "doi_he_so", label: "Đổi hệ số, đỉnh nguyên", description: "Parabol mới có hoành độ đỉnh nguyên.", kinds: ["vertex", "min_value"],
    make: (s, r) => {
      const want = s.kind === "min_value" ? (s.extreme === "max" ? -1 : 1) : pick([1, -1]);
      const a = Math.abs(pick(r.leads)) * want, h = nonZero(-5, 5), c = rand(-9, 9);
      return { structure: { ...s, P: fromCoeffs([q(a), q(-2 * a * h), q(c)]), ask: "solve" }, transform: `Parabol mới có đỉnh tại $x = ${h}$, hệ số $a = ${a}$` };
    },
  },
  {
    code: "doi_cau_hoi", label: "Đổi câu hỏi", description: "Cùng parabol: hỏi tọa độ đỉnh ↔ giá trị lớn nhất/nhỏ nhất.", kinds: ["vertex", "min_value"],
    make: (s) => {
      if (s.kind === "vertex") {
        const extreme = toNumber(coeffsX(s.P)[0]) > 0 ? "min" : "max";
        return { structure: { kind: "min_value", P: s.P, extreme, ask: "solve" }, transform: `Hỏi giá trị ${extreme === "min" ? "nhỏ nhất" : "lớn nhất"} thay vì tọa độ đỉnh` };
      }
      return { structure: { kind: "vertex", P: s.P, ask: "solve" }, transform: "Hỏi tọa độ đỉnh thay vì giá trị lớn nhất/nhỏ nhất" };
    },
  },
];

export function rulesFor(kind: Kind) {
  return RULES.filter((r) => r.kinds.includes(kind)).map(({ code, label, description }) => ({ code, label, description }));
}

/** Chọn câu hỏi phù hợp hình thức: "trả lời ngắn" cần đúng một đáp số. */
function applyFormat(s: Structure, format: Format): Structure | null {
  const base = { ...s, ask: "solve" as const };
  if (format !== "short") return base;
  const tryAsk = (...asks: Structure["ask"][]) => {
    for (const ask of asks) {
      try {
        if (solve({ ...s, ask }).short) return { ...s, ask };
      } catch {
        // thử câu hỏi tiếp theo
      }
    }
    return null;
  };
  switch (s.kind) {
    case "quadratic_equation":
      return tryAsk("max_root", "sum_roots", "solve");
    case "quadratic_param":
      return tryAsk("solve", "max_int_m", "min_int_m");
    case "linear_inequality":
      return tryAsk("min_int", "max_int");
    case "quadratic_inequality":
      return tryAsk("count_int");
    case "factorization":
      return tryAsk("b_factor");
    case "vertex":
      return tryAsk("vertex_x");
    default:
      return tryAsk("solve");
  }
}

function buildChoices(s: Structure, solved: Solved): { choices: Choice[]; answer: string; correct: string } | null {
  const text = (x: Solved) => x.choiceText ?? x.display;
  const correct = text(solved);
  const options = new Set([correct]);
  for (const m of nearMisses(s)) {
    if (options.size >= 4) break;
    try {
      options.add(text(solve(m)));
    } catch {
      // phương án nhiễu không giải được thì bỏ
    }
  }
  if (options.size < 4) return null;
  const all = shuffle([...options]);
  const keys = ["A", "B", "C", "D"];
  return { choices: all.map((content, i) => ({ key: keys[i], content })), answer: keys[all.indexOf(correct)], correct };
}

export interface DedupeIndex {
  /** khóa chuẩn → mã bài trong ngân hàng */
  bank: Map<string, string>;
  /** khóa chuẩn → "Câu n" của đề tải lên */
  source: Map<string, string>;
}

export interface GeneratedVariant {
  statement: string;
  format: Format;
  choices: Choice[];
  answer_display: string;
  answer_short: string | null;
  answer_prefix: string | null;
  solution: string[];
  rule: { code: string; label: string; description: string };
  transform: string;
  structure: Structure;
  key: string;
  difficulty: number;
  checks: VerificationCheck[];
  accepted: boolean;
}

function buildVariant(draft: Draft, rule: RuleDef, format: Format, idx: DedupeIndex): GeneratedVariant | null {
  const s = applyFormat(draft.structure, format);
  if (!s) return null;
  const statement = render(s, draft.pres);
  let solved: Solved;
  try {
    solved = solve(s);
  } catch {
    return null;
  }
  if (format === "short" && !solved.short) return null;

  // Kiểm chứng ngược: coi đề vừa sinh như một đề mới, nhận dạng và giải lại.
  const back = recognize(statement);
  let roundTrip = false;
  if (back.ok && canonicalKey(back.structure) === canonicalKey(s) && back.structure.ask === s.ask) {
    try {
      roundTrip = solve(back.structure).key === solved.key;
    } catch {
      roundTrip = false;
    }
  }

  const key = canonicalKey(s);
  const srcDup = idx.source.get(key);
  const bankDup = idx.bank.get(key);
  const checks: VerificationCheck[] = [
    { label: "Kiểm chứng ngược: đọc lại đề vừa sinh, nhận dạng và giải lại cho cùng đáp án", passed: roundTrip },
    ...solved.checks,
    { label: srcDup ? `Trùng với ${srcDup} của đề tải lên (cùng dạng chuẩn)` : "Không trùng với đề tải lên", passed: !srcDup },
    { label: bankDup ? `Trùng bài ${bankDup} trong ngân hàng` : "Không trùng ngân hàng bài", passed: !bankDup },
  ];

  let choices: Choice[] = [];
  let display = solved.display;
  if (format === "choice") {
    const c = buildChoices(s, solved);
    if (!c) return null;
    choices = c.choices;
    display = `${c.answer}. ${c.correct}`;
  }

  return {
    statement,
    format,
    choices,
    answer_display: display,
    answer_short: format === "short" && solved.short ? plain(solved.short) : null,
    answer_prefix: format === "short" ? (solved.shortLabel ?? null) : null,
    solution: solved.steps,
    rule: { code: rule.code, label: rule.label, description: rule.description },
    transform: draft.transform,
    structure: s,
    key,
    difficulty: estimateDifficulty(s),
    checks,
    accepted: checks.every((c) => c.passed),
  };
}

/** Sinh tới `count` biến thể đạt chuẩn; kèm tối đa 2 biến thể bị loại để giáo viên thấy bộ lọc hoạt động. */
export function generateVariants(
  src: Structure,
  opts: { count: number; rules: string[]; target: Target; format: Format },
  idx: DedupeIndex,
): GeneratedVariant[] {
  const rules = RULES.filter((r) => r.kinds.includes(src.kind) && opts.rules.includes(r.code));
  if (!rules.length) return [];
  const r = ranges(src, opts.target);
  const accepted: GeneratedVariant[] = [];
  const rejected: GeneratedVariant[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; accepted.length < opts.count && attempt < opts.count * 10; attempt++) {
    const rule = rules[attempt % rules.length];
    let draft: Draft | null;
    try {
      draft = rule.make(src, r);
    } catch {
      continue;
    }
    if (!draft) continue;
    const v = buildVariant(draft, rule, opts.format, idx);
    if (!v || seen.has(v.key)) continue; // trùng trong cùng lô: bỏ, không cần báo
    seen.add(v.key);
    if (v.accepted) accepted.push(v);
    else if (rejected.length < 2) rejected.push(v);
  }
  return [...accepted, ...rejected];
}
