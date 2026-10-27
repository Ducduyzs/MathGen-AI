// Bộ sinh đề theo dạng bài cho mock API: mỗi dạng (template) sinh số liệu mới ở mỗi lần gọi,
// kèm đáp án và lời giải. Backend thật sẽ lấy từ ngân hàng đã kiểm chứng + biến thể do generator sinh.
import type { ExamMode, ExamQuestionType } from "@/types/api";
import {
  distinctPair, factor, frac, lin, makeChoices, nonZero, number, pick, poly, quad, r, rand, shuffle, sum, tf, coin,
  type ExamTemplate,
} from "./gen-utils";
import { PRIMARY_TEMPLATES } from "./primary-templates";
import { buildThptTemplates, THPT_TEMPLATES } from "./thpt-templates";

export type { ExamTemplate } from "./gen-utils";

/** Dạng bài Đại số lớp 6–10 (đề ôn tập). */
const ALGEBRA_TEMPLATES: ExamTemplate[] = [
  // ---------------- Trắc nghiệm A/B/C/D
  {
    code: "lin_eq_choice", name: "Phương trình bậc nhất", skill: "linear_equation", grade: 8, difficulty: 0.2, mode: "choice", type: "choice",
    make: () => {
      const a = rand(2, 9), x0 = rand(-9, 9), b = nonZero(-15, 15), c = a * x0 + b;
      const m = makeChoices(`x = ${x0}`, [x0 + 1, x0 - 1, -x0, x0 + 2, x0 - 2].map((v) => `x = ${v}`));
      return {
        statement: r`Nghiệm của phương trình $${lin(a, b)} = ${c}$ là`, ...m,
        solution: [r`$${a}x = ${c} ${b < 0 ? "+" : "-"} ${Math.abs(b)} = ${c - b}$`, r`$x = ${x0}$`],
      };
    },
  },
  {
    code: "factor_diff_squares", name: "Hằng đẳng thức hiệu hai bình phương", skill: "factorization", grade: 8, difficulty: 0.3, mode: "choice", type: "choice",
    make: () => {
      const k = rand(2, 12);
      const m = makeChoices(`(x - ${k})(x + ${k})`, [`(x - ${k})^2`, `(x + ${k})^2`, `(x - ${k * k})(x + 1)`, `x(x - ${k * k})`]);
      return {
        statement: r`Phân tích đa thức $x^2 - ${k * k}$ thành nhân tử.`, ...m,
        solution: [r`$x^2 - ${k * k} = x^2 - ${k}^2 = (x - ${k})(x + ${k})$`],
      };
    },
  },
  {
    code: "factor_trinomial", name: "Phân tích tam thức bậc hai", skill: "factorization", grade: 8, difficulty: 0.5, mode: "choice", type: "choice",
    make: () => {
      const [p, q] = distinctPair(1, 9);
      const m = makeChoices(`${factor(p)}${factor(q)}`, [
        `${factor(-p)}${factor(-q)}`, `${factor(p)}${factor(-q)}`, `${factor(-p)}${factor(q)}`, `${factor(p + q)}${factor(1)}`,
      ]);
      return {
        statement: r`Phân tích đa thức $${quad(-(p + q), p * q)}$ thành nhân tử.`, ...m,
        solution: [r`Hai số có tổng $${p + q}$ và tích $${p * q}$ là $${p}$ và $${q}$`, r`$${quad(-(p + q), p * q)} = ${factor(p)}${factor(q)}$`],
      };
    },
  },
  {
    code: "ineq_linear_choice", name: "Bất phương trình bậc nhất", skill: "inequality", grade: 8, difficulty: 0.45, mode: "choice", type: "choice",
    make: () => {
      const a = pick([-5, -4, -3, -2, 2, 3, 4, 5]), x0 = rand(-6, 6), b = nonZero(-10, 10), c = a * x0 + b;
      const signs = [">", "<", r`\ge`, r`\le`];
      const flip: Record<string, string> = { ">": "<", "<": ">", [r`\ge`]: r`\le`, [r`\le`]: r`\ge` };
      const s = pick(signs);
      const res = a < 0 ? flip[s] : s;
      const m = makeChoices(`x ${res} ${x0}`, signs.map((sg) => `x ${sg} ${x0}`));
      return {
        statement: r`Giải bất phương trình $${lin(a, b)} ${s} ${c}$.`, ...m,
        solution: [
          r`$${poly([[a, "x"]])} ${s} ${c - b}$`,
          a < 0 ? r`Chia hai vế cho $${a} < 0$ và đổi chiều: $x ${res} ${x0}$` : r`Chia hai vế cho $${a}$: $x ${res} ${x0}$`,
        ],
      };
    },
  },
  {
    code: "quad_param_choice", name: "Điều kiện có hai nghiệm phân biệt", skill: "quadratic_equation", grade: 9, difficulty: 0.7, mode: "choice", type: "choice",
    make: () => {
      const b = rand(2, 9), F = frac(b * b, 4);
      const m = makeChoices(`m < ${F}`, [`m > ${F}`, r`m \le ${F}`, r`m \ge ${F}`, `m < ${b * b}`]);
      return {
        statement: r`Tìm $m$ để phương trình $x^2 - ${b}x + m = 0$ có hai nghiệm phân biệt.`, ...m,
        solution: [r`$\Delta = ${b * b} - 4m$`, r`$\Delta > 0 \Leftrightarrow m < ${F}$`],
      };
    },
  },
  {
    code: "func_value_choice", name: "Giá trị hàm số bậc nhất", skill: "function", grade: 9, difficulty: 0.25, mode: "choice", type: "choice",
    make: () => {
      const a = nonZero(-5, 5), b = nonZero(-9, 9), t = nonZero(-4, 4), v = a * t + b;
      const m = makeChoices(`${v}`, [v + a, v - a, -v, a * t - b, v + 1, v - 1].map(String));
      return {
        statement: r`Cho hàm số $y = ${lin(a, b)}$. Giá trị của $y$ khi $x = ${t}$ là`, ...m,
        solution: [r`$y = ${a} \cdot (${t}) ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${v}$`],
      };
    },
  },
  {
    code: "vertex_choice", name: "Tọa độ đỉnh parabol", skill: "function", grade: 10, difficulty: 0.55, mode: "choice", type: "choice",
    make: () => {
      const b = pick([-8, -6, -4, -2, 2, 4, 6, 8]), c = rand(-5, 6), h = -b / 2, k = c - (b * b) / 4;
      const pt = (x: number, y: number) => r`(${x};\ ${y})`;
      const m = makeChoices(pt(h, k), [pt(-h, k), pt(h, -k), pt(-h, -k), pt(h, c), pt(k, h)]);
      return {
        statement: r`Tọa độ đỉnh của parabol $y = ${quad(b, c)}$ là`, ...m,
        solution: [r`$x_0 = -\dfrac{b}{2a} = ${h}$`, r`$y_0 = ${sum([h * h, b * h, c])} = ${k}$`],
      };
    },
  },

  // ---------------- Đúng/Sai
  {
    code: "tf_quadratic", name: "Đúng/Sai: phương trình bậc hai", skill: "quadratic_equation", grade: 9, difficulty: 0.6, mode: "choice", type: "true_false",
    make: () => {
      const [p, q] = distinctPair(-6, 6, true);
      const S = p + q, P = p * q;
      const t = [coin(), coin(), coin(), coin()];
      const wrongRoot = [p + 1, p - 1, q + 1, -p, p + 2].find((v) => v !== p && v !== q)!;
      const g = tf(
        [
          t[0] ? "Phương trình có hai nghiệm phân biệt." : "Phương trình vô nghiệm.",
          `Tổng hai nghiệm bằng $${t[1] ? S : S === 0 ? 1 : -S}$.`,
          `Tích hai nghiệm bằng $${t[2] ? P : P + pick([-2, -1, 1, 2])}$.`,
          `$x = ${t[3] ? p : wrongRoot}$ là một nghiệm của phương trình.`,
        ],
        t,
      );
      return {
        statement: r`Cho phương trình $${quad(-S, P)} = 0$. Mỗi ý sau đúng hay sai?`, ...g,
        solution: [
          r`$${quad(-S, P)} = ${factor(p)}${factor(q)}$ nên phương trình có hai nghiệm phân biệt $x = ${p}$, $x = ${q}$`,
          r`Tổng hai nghiệm bằng $${S}$, tích hai nghiệm bằng $${P}$`,
        ],
      };
    },
  },
  {
    code: "tf_linear_function", name: "Đúng/Sai: hàm số bậc nhất", skill: "function", grade: 9, difficulty: 0.45, mode: "choice", type: "true_false",
    make: () => {
      const a = nonZero(-5, 5), b = nonZero(-6, 6), t0 = nonZero(-3, 3), v = a * t0 + b;
      const t = [a > 0, coin(), coin(), coin()];
      const g = tf(
        [
          r`Hàm số đồng biến trên $\mathbb{R}$.`,
          r`Đồ thị hàm số đi qua điểm $(0;\ ${t[1] ? b : -b})$.`,
          `Khi $x = ${t0}$ thì $y = ${t[2] ? v : v + pick([-2, -1, 1, 2])}$.`,
          `Đồ thị cắt trục hoành tại điểm có hoành độ $${t[3] ? frac(-b, a) : frac(b, a)}$.`,
        ],
        t,
      );
      return {
        statement: r`Cho hàm số $y = ${lin(a, b)}$. Mỗi ý sau đúng hay sai?`, ...g,
        solution: [
          r`$a = ${a} ${a > 0 ? ">" : "<"} 0$ nên hàm số ${a > 0 ? "đồng biến" : "nghịch biến"} trên $\mathbb{R}$`,
          r`$x = 0 \Rightarrow y = ${b}$; $x = ${t0} \Rightarrow y = ${v}$`,
          r`$y = 0 \Leftrightarrow x = ${frac(-b, a)}$`,
        ],
      };
    },
  },

  // ---------------- Tự luận: điền đáp số
  {
    code: "lin_eq_number", name: "Phương trình bậc nhất", skill: "linear_equation", grade: 8, difficulty: 0.25, mode: "written", type: "number",
    make: () => {
      const a = rand(2, 9), x0 = rand(-9, 9), b = nonZero(-15, 15), c = a * x0 + b;
      return {
        statement: r`Giải phương trình $${lin(a, b)} = ${c}$.`, answer_prefix: "x =",
        answer: number(x0), answer_display: `$x = ${x0}$`,
        solution: [r`$${a}x = ${c - b}$`, r`$x = ${x0}$`],
      };
    },
  },
  {
    code: "lin_eq_fraction", name: "Phương trình chứa phân số", skill: "linear_equation", grade: 8, difficulty: 0.55, mode: "written", type: "number",
    make: () => {
      const [m, n] = shuffle([2, 3, 4, 5, 6]).slice(0, 2);
      const k = nonZero(-5, 5), x0 = rand(-6, 9), p = m * k - x0, q = n * k - x0;
      return {
        statement: r`Giải phương trình $\dfrac{${lin(1, p)}}{${m}} = \dfrac{${lin(1, q)}}{${n}}$.`, answer_prefix: "x =",
        answer: number(x0), answer_display: `$x = ${x0}$`,
        solution: [r`$${n}(${lin(1, p)}) = ${m}(${lin(1, q)})$`, r`$${poly([[n - m, "x"]])} = ${m * q - n * p}$`, r`$x = ${x0}$`],
      };
    },
  },
  {
    code: "factor_root_written", name: "Phân tích nhân tử, tìm hệ số", skill: "factorization", grade: 8, difficulty: 0.45, mode: "written", type: "number",
    make: () => {
      const [p, q] = distinctPair(-9, 9, true);
      return {
        statement: r`Biết $${quad(-(p + q), p * q)} = (x - a)(x - b)$ với $a < b$. Tìm $b$.`, answer_prefix: "b =",
        answer: number(q), answer_display: `$b = ${q}$`,
        solution: [r`Hai số có tổng $${p + q}$ và tích $${p * q}$ là $${p}$ và $${q}$`, r`$${quad(-(p + q), p * q)} = ${factor(p)}${factor(q)}$ nên $b = ${q}$`],
      };
    },
  },
  {
    code: "ineq_smallest_int", name: "Nghiệm nguyên nhỏ nhất của bất phương trình", skill: "inequality", grade: 8, difficulty: 0.55, mode: "written", type: "number",
    make: () => {
      const a = rand(2, 5), b = nonZero(-10, 10), c = rand(-15, 15);
      const ans = Math.floor((c - b) / a) + 1;
      return {
        statement: r`Tìm số nguyên $x$ nhỏ nhất thỏa mãn $${lin(a, b)} > ${c}$.`, answer_prefix: "x =",
        answer: number(ans), answer_display: `$x = ${ans}$`,
        solution: [r`$${a}x > ${c - b} \Leftrightarrow x > ${frac(c - b, a)}$`, r`Số nguyên nhỏ nhất thỏa mãn là $${ans}$`],
      };
    },
  },
  {
    code: "quad_max_root", name: "Nghiệm của phương trình bậc hai", skill: "quadratic_equation", grade: 9, difficulty: 0.5, mode: "written", type: "number",
    make: () => {
      const [p, q] = distinctPair(-9, 9, true);
      return {
        statement: r`Tìm nghiệm lớn nhất của phương trình $${quad(-(p + q), p * q)} = 0$.`, answer_prefix: "x =",
        answer: number(q), answer_display: `$x = ${q}$`,
        solution: [r`$${quad(-(p + q), p * q)} = ${factor(p)}${factor(q)} = 0$`, r`Hai nghiệm $x = ${p}$, $x = ${q}$; nghiệm lớn nhất là $${q}$`],
      };
    },
  },
  {
    code: "quad_double_root", name: "Điều kiện có nghiệm kép", skill: "quadratic_equation", grade: 9, difficulty: 0.65, mode: "written", type: "number",
    make: () => {
      const b = pick([2, 4, 6, 8, 10, 12]);
      return {
        statement: r`Tìm $m$ để phương trình $x^2 - ${b}x + m = 0$ có nghiệm kép.`, answer_prefix: "m =",
        answer: number((b * b) / 4), answer_display: `$m = ${(b * b) / 4}$`,
        solution: [r`Phương trình có nghiệm kép khi $\Delta = ${b * b} - 4m = 0$`, r`$m = ${(b * b) / 4}$`],
      };
    },
  },
  {
    code: "func_quad_value", name: "Giá trị hàm số bậc hai", skill: "function", grade: 10, difficulty: 0.45, mode: "written", type: "number",
    make: () => {
      const b = nonZero(-6, 6), c = rand(-8, 8), t = nonZero(-4, 4), v = t * t + b * t + c;
      return {
        statement: r`Cho $f(x) = ${quad(b, c)}$. Tính $f(${t})$.`, answer_prefix: `f(${t}) =`,
        answer: number(v), answer_display: `$f(${t}) = ${v}$`,
        solution: [r`$f(${t}) = ${sum([t * t, b * t, c])} = ${v}$`],
      };
    },
  },
  {
    code: "func_min_value", name: "Giá trị nhỏ nhất của hàm bậc hai", skill: "function", grade: 10, difficulty: 0.6, mode: "written", type: "number",
    make: () => {
      const b = pick([-8, -6, -4, -2, 2, 4, 6, 8]), c = rand(-5, 8), h = -b / 2, k = c - (b * b) / 4;
      return {
        statement: r`Tìm giá trị nhỏ nhất của hàm số $y = ${quad(b, c)}$.`, answer_prefix: r`y_{\min} =`,
        answer: number(k), answer_display: r`$y_{\min} = ${k}$`,
        solution: [r`$a = 1 > 0$, đỉnh tại $x_0 = -\dfrac{b}{2a} = ${h}$`, r`$y_{\min} = y(${h}) = ${k}$`],
      };
    },
  },
];

export const TEMPLATES: ExamTemplate[] = [...PRIMARY_TEMPLATES, ...ALGEBRA_TEMPLATES, ...THPT_TEMPLATES];

/** Học sinh tiểu học (lớp 1–5). Chưa có lớp thì coi như từ lớp 6. */
export const isPrimary = (grade: number | null | undefined) => grade != null && grade <= 5;

/** Dạng bài hợp với học sinh: cùng cấp học; tiểu học chỉ tới lớp trên kế tiếp (lớp 2 không gặp phân số lớp 4). */
export const forGrade = (t: ExamTemplate, grade: number | null | undefined) => (isPrimary(grade) ? t.grade <= grade! + 1 : t.grade > 5);

const TYPE_ORDER: ExamQuestionType[] = ["choice", "true_false", "number"];

function generate(templates: ExamTemplate[]) {
  const seen = new Set<string>();
  return templates.map((template) => {
    let g = template.make();
    for (let tries = 0; seen.has(g.statement) && tries < 8; tries++) g = template.make();
    seen.add(g.statement);
    return { template, ...g };
  });
}

/** Rút xoay vòng để các dạng xuất hiện đều nhau, xếp dễ → khó. */
function draw(ts: ExamTemplate[], n: number) {
  const out: ExamTemplate[] = [];
  let bag: ExamTemplate[] = [];
  for (let i = 0; i < n; i++) {
    if (!bag.length) bag = shuffle(ts);
    out.push(bag.pop()!);
  }
  return out.sort((a, b) => a.difficulty - b.difficulty);
}

/**
 * Đề ôn tập. Trắc nghiệm: ~20% câu Đúng/Sai, còn lại A/B/C/D. Tự luận: điền đáp số.
 * Khi truyền `templates` (đề từ dạng đã sai) thì lấy đúng các dạng đó, bất kể hình thức.
 */
export function buildQuestions(mode: ExamMode, size: number, opts: { skills?: string[]; templates?: string[]; grade?: number | null }) {
  if (opts.templates?.length) {
    const pool = TEMPLATES.filter((t) => opts.templates!.includes(t.code));
    if (!pool.length) return null;
    const chosen = draw(pool, size).sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
    return generate(chosen);
  }

  // Không chọn chủ đề: chỉ lấy dạng bài đúng cấp học của học sinh
  const pool = TEMPLATES.filter(
    (t) => t.mode === mode && (opts.skills?.length ? opts.skills.includes(t.skill) : forGrade(t, opts.grade)),
  );
  if (!pool.length) return null;
  const tfPool = pool.filter((t) => t.type === "true_false");
  const mainPool = pool.filter((t) => t.type !== "true_false");
  let nTF = mode === "choice" ? Math.round(size * 0.2) : 0;
  if (!tfPool.length) nTF = 0;
  if (!mainPool.length) nTF = size;
  return generate([...draw(mainPool, size - nTF), ...draw(tfPool, nTF)]);
}

/** Đề thi tốt nghiệp THPT: 12 câu Phần I + 4 câu Phần II + 6 câu Phần III. */
export function buildThptQuestions() {
  return generate(buildThptTemplates());
}
