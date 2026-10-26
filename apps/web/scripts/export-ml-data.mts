// Xuất dữ liệu tổng hợp tiếng Việt cho ml/ từ bộ sinh đề + pipeline kiểm chứng:
//   problems.jsonl — đề có nhãn chính xác (dạng bài, kỹ năng, lớp, độ khó, kiểu câu) → mô hình phân loại
//   pairs.jsonl    — cặp đề gốc → biến thể kèm kết quả kiểm chứng (cả biến thể bị loại) → mô hình sinh
// Chạy: npm run ml:export -- --out ../../ml/data/raw/synthetic_vi --seed 2026 --per-template 300
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ---- RNG có seed: phải đặt TRƯỚC khi import bộ sinh (bộ sinh dùng Math.random)
const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
let seed = Number(arg("seed", "2026")) >>> 0;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const { TEMPLATES } = await import("../src/mocks/exam-generator");
const { generateVariants, recognize, canonicalKey } = await import("../src/mocks/pipeline");
const { RULES } = await import("../src/mocks/pipeline/generate");
const { render, KIND_SKILL } = await import("../src/mocks/pipeline/structure");
const { estimateDifficulty } = await import("../src/mocks/pipeline/canonical");
const { solve } = await import("../src/mocks/pipeline/solve");

const OUT = resolve(arg("out", "../../ml/data/raw/synthetic_vi"));
const PER_TEMPLATE = Number(arg("per-template", "300"));
const SEEDS_PER_KIND = Number(arg("seeds-per-kind", "60"));

/** LaTeX → chữ thường kiểu PDF/Word: x^2 → x², \le → ≤, \dfrac{a}{b} → a/b … */
function toPlain(s: string) {
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  let t = s.replace(/\$/g, "");
  for (let i = 0; i < 3; i++) t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => (/^[\w.]+$/.test(a) ? a : `(${a})`) + "/" + (/^[\w.]+$/.test(b) ? b : `(${b})`));
  return t
    .replace(/\^\{?(\d)\}?/g, (_, d) => sup[d])
    .replace(/\\left|\\right|\\displaystyle|\\limits|\\,/g, "")
    .replace(/\\le\b/g, "≤").replace(/\\ge\b/g, "≥").replace(/\\ne\b/g, "≠")
    .replace(/\\cdot/g, "·").replace(/\\pm/g, "±").replace(/\\infty/g, "∞").replace(/\\Delta/g, "Δ")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)").replace(/\\mathbb\{R\}/g, "ℝ").replace(/\\overrightarrow\{(\w+)\}/g, "vectơ $1")
    .replace(/\\int_\{?([^{}\s]+)\}?\^\{?([^{}\s]+)\}?/g, "∫ từ $1 đến $2").replace(/\\log_(\w)/g, "log_$1")
    .replace(/\\text\{([^{}]*)\}/g, "$1").replace(/\\Leftrightarrow/g, "⇔").replace(/\\(\w+)/g, "$1")
    .replace(/[{}]/g, "").replace(/\\ /g, " ").replace(/-/g, "–").replace(/\s+/g, " ").trim();
}

const TOPIC: Record<string, string> = {
  linear_equation: "algebra", quadratic_equation: "algebra", inequality: "algebra", factorization: "algebra",
  function: "functions", calculus: "calculus", exp_log: "exp_log", sequences: "sequences",
  geometry_space: "geometry", coordinates_3d: "coordinates", probability_statistics: "probability_counting",
};
const topicOf = (skill: string, code: string) => (code.includes("range") ? "statistics" : TOPIC[skill] ?? "other");
const band = (g: number) => (g <= 5 ? "primary" : g <= 9 ? "lower_secondary" : "upper_secondary");

const problems: object[] = [];
const pairs: object[] = [];
const seen = new Set<string>();
const push = (rec: { id: string; text: string } & Record<string, unknown>) => {
  if (seen.has(rec.text)) return;
  seen.add(rec.text);
  problems.push(rec);
};

// ---------------- 1. Câu hỏi theo dạng bài (42 dạng: đại số 6–10 + đề thi THPT)
let n = 0;
for (const t of TEMPLATES) {
  let prev: { text: string; answer: string } | null = null;
  for (let i = 0; i < PER_TEMPLATE; i++) {
    const g = t.make();
    const statements = g.statements?.map((s) => `${s.key}) ${s.content}`) ?? [];
    const latexText = [g.statement, ...statements].join("\n");
    const labels = {
      topic: topicOf(t.skill, t.code), skill: t.skill, template: t.code, kind: null, grade: t.grade, grade_band: band(t.grade),
      difficulty: t.difficulty, qtype: t.type === "choice" ? "mcq" : t.type === "true_false" ? "tf" : "short", part: t.part ?? null,
    };
    // Bản LaTeX và bản chữ thường của cùng một đề chung `group` → luôn nằm cùng một tập khi chia train/test.
    const group = `tpl:${n}`;
    for (const render of ["latex", "plain"] as const) {
      const text = render === "latex" ? latexText : toPlain(latexText);
      push({ id: `synthetic_vi:tpl:${n++}`, group, text, render, choices: g.choices?.map((c) => (render === "latex" ? c.content : toPlain(c.content))) ?? null, answer: g.answer_display, solution: g.solution.join("\n"), labels });
    }
    // Cặp cùng dạng, khác số liệu (đúng theo cách dựng)
    const cur = { text: latexText, answer: g.answer_display };
    if (prev && i % 2 === 1) {
      pairs.push({ id: `synthetic_vi:tplpair:${pairs.length}`, relation: `template:${t.code}`, seed: prev, target: { ...cur, solution: g.solution.join("\n") }, verified: "by_construction", meta: { skill: t.skill, grade: t.grade } });
    }
    prev = cur;
  }
}

// ---------------- 2. Đề sinh qua pipeline (9 dạng có cấu trúc) + cặp biến thể đã kiểm chứng
const SEED_TEXTS = [
  "Giải phương trình 3(x – 2) = 2x + 1.",
  "Giải phương trình x² – 5x + 6 = 0.",
  "Tìm m để phương trình x² – 4x + m = 0 có hai nghiệm phân biệt.",
  "Giải bất phương trình –3x + 2 ≤ 11.",
  "Giải bất phương trình x² – 3x – 4 < 0.",
  "Phân tích đa thức x² – 9 thành nhân tử.",
  "Cho hàm số y = 2x + 3. Tính giá trị của y khi x = –1.",
  "Tìm tọa độ đỉnh của parabol y = x² – 4x + 1.",
  "Tìm giá trị nhỏ nhất của hàm số y = x² – 4x + 1.",
];
const FORMATS = ["original", "choice", "short"] as const;
const TARGETS = ["easier", "same", "harder"] as const;
const pickOne = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const empty = { bank: new Map<string, string>(), source: new Map<string, string>() };

for (const text of SEED_TEXTS) {
  const base = recognize(text);
  if (!base.ok) throw new Error(`Không nhận dạng được đề mồi: ${text}`);
  const rules = RULES.filter((r) => r.kinds.includes(base.structure.kind)).map((r) => r.code);
  // Mồi đa dạng: biến thể "đổi hệ số" của đề mồi gốc, rồi sinh tiếp từ từng mồi.
  const seeds = [base.structure, ...generateVariants(base.structure, { count: SEEDS_PER_KIND, rules, target: "same", format: "original" }, empty).filter((v) => v.accepted).map((v) => v.structure)];
  for (const s of seeds) {
    const seedText = render(s);
    const seedSolved = solve(s);
    const meta = KIND_SKILL[s.kind];
    const group = `pipe:${n}`;
    for (const r of ["latex", "plain"] as const) {
      push({
        id: `synthetic_vi:pipe:${n++}`, group, text: r === "latex" ? seedText : toPlain(seedText), render: r, choices: null,
        answer: seedSolved.display, solution: seedSolved.steps.join("\n"),
        labels: { topic: topicOf(meta.skill, ""), skill: meta.skill, template: null, kind: s.kind, grade: meta.grade, grade_band: band(meta.grade), difficulty: estimateDifficulty(s), qtype: "free", part: null },
      });
    }
    const opts = { count: 3, rules: [pickOne(rules)], target: pickOne(TARGETS), format: pickOne(FORMATS) };
    const source = new Map([[canonicalKey(s), "đề gốc"]]);
    for (const v of generateVariants(s, opts, { bank: new Map(), source })) {
      pairs.push({
        id: `synthetic_vi:rulepair:${pairs.length}`, relation: `rule:${v.rule.code}`,
        seed: { text: seedText, answer: seedSolved.display },
        target: { text: v.statement, answer: v.answer_display, short: v.answer_short, choices: v.choices, solution: v.solution.join("\n") },
        verified: v.accepted, failed_checks: v.checks.filter((c) => !c.passed).map((c) => c.label),
        meta: { kind: v.structure.kind, format: v.format, target: opts.target, transform: v.transform, difficulty: v.difficulty },
      });
    }
  }
}

mkdirSync(OUT, { recursive: true });
const jsonl = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
writeFileSync(join(OUT, "problems.jsonl"), jsonl(problems), "utf8");
writeFileSync(join(OUT, "pairs.jsonl"), jsonl(pairs), "utf8");
writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify({
    name: "synthetic_vi", repo: "apps/web (bộ sinh đề + pipeline kiểm chứng)", license: "Nội bộ dự án", tier: "open", lang: "vi", country: "VN",
    note: "Sinh tự động; nhãn chính xác theo cách dựng. Seed RNG cố định để tái lập.",
    seed: Number(arg("seed", "2026")), per_template: PER_TEMPLATE, templates: TEMPLATES.length, problems: problems.length, pairs: pairs.length,
    downloaded_at: new Date().toISOString().slice(0, 10),
  }, null, 2),
  "utf8",
);
console.log(`problems: ${problems.length} · pairs: ${pairs.length} (đã kiểm chứng: ${pairs.filter((p: any) => p.verified === true).length}, bị loại: ${pairs.filter((p: any) => p.verified === false).length}) → ${OUT}`);
