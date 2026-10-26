// Kiểm chứng đầu ra của mô hình sinh (samples.jsonl từ ml/train/train_generator.py) bằng chính pipeline của dự án:
//   JSON hợp lệ → nhận dạng được → giải được → đáp án mô hình đưa ra khớp lời giải → cùng dạng với đề gốc
//   → khác đề gốc (dạng chuẩn) → không trùng ngân hàng.
// Chạy: npm run ml:verify -- --in ../../ml/runs/<run>/samples.jsonl
import { readFileSync, writeFileSync } from "node:fs";
import { PROBLEMS } from "../src/mocks/data";
import { buildBankIndex, canonicalKey, recognize } from "../src/mocks/pipeline";
import { parseExpr } from "../src/mocks/pipeline/parse";
import { constOf, isConst } from "../src/mocks/pipeline/poly";
import { eq } from "../src/mocks/pipeline/rational";
import { solve } from "../src/mocks/pipeline/solve";

const arg = (name: string, def = "") => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const input = arg("in");
if (!input) throw new Error("Thiếu --in <samples.jsonl>");

const rows = readFileSync(input, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const bank = buildBankIndex(PROBLEMS);

function parseJson(out: string): Record<string, unknown> | null {
  const t = out.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

const norm = (s: string) =>
  s
    .replace(/^[A-D]\.\s*/, "")
    .replace(/\\left|\\right|\\,|\\;|\\ /g, "")
    .replace(/\{,\}/g, ".")
    .replace(/[\s$]/g, "")
    .replace(/\(nghiệmkép\)/, "")
    .replace(/^I(?=\()/, ""); // tọa độ đỉnh: "I(2; -9)" ≡ "(2; -9)"

/** Đáp án mô hình khớp lời giải: so chuỗi sau chuẩn hóa, hoặc so giá trị số (x = 3/2 ≡ 1,5). */
function answerMatches(answer: string, solved: ReturnType<typeof solve>) {
  if (norm(answer) === norm(solved.display) || (solved.choiceText && norm(answer) === norm(solved.choiceText))) return true;
  if (!solved.short) return false;
  const rhs = answer.replace(/\$/g, "").split("=").pop() ?? "";
  try {
    const p = parseExpr(rhs.replace(/\(nghiệm kép\)/, ""));
    return isConst(p) && eq(constOf(p), solved.short);
  } catch {
    return false;
  }
}

type Verdict = "invalid_json" | "out_of_scope" | "not_recognized" | "unsolvable" | "wrong_answer" | "other_kind" | "same_as_seed" | "bank_duplicate" | "ok";
const results: { id: string; relation: string; verdict: Verdict; statement?: string; answer?: string; expected?: string }[] = [];
let enValid = 0;
let enTotal = 0;

for (const r of rows) {
  const obj = parseJson(r.output);
  if (r.lang !== "vi") {
    enTotal++;
    if (obj && typeof obj.statement === "string" && obj.answer != null) enValid++;
    continue;
  }
  const relation = String(r.relation).split(":")[0];
  const push = (verdict: Verdict, extra = {}) => results.push({ id: r.id, relation, verdict, ...extra });
  if (!obj || typeof obj.statement !== "string") {
    push("invalid_json");
    continue;
  }
  const statement = obj.statement;
  const answer = String(obj.answer ?? "");
  const seedRec = recognize(r.seed.text);
  const rec = recognize(statement);
  if (!seedRec.ok) {
    push("out_of_scope", { statement, answer }); // dạng bài ngoài phạm vi bộ kiểm chứng (ví dụ Oxyz, xác suất)
    continue;
  }
  if (!rec.ok) {
    push("not_recognized", { statement, answer });
    continue;
  }
  let solved;
  try {
    solved = solve(rec.structure);
  } catch {
    push("unsolvable", { statement, answer });
    continue;
  }
  // Dạng mong đợi lấy từ đáp án mẫu (luật như "thêm tham số m" cố ý đổi dạng so với đề gốc).
  const refRec = recognize((r.reference ?? r.target).text);
  const expectedKind = refRec.ok ? refRec.structure.kind : seedRec.structure.kind;
  if (!answerMatches(answer, solved)) push("wrong_answer", { statement, answer, expected: solved.display });
  else if (rec.structure.kind !== expectedKind) push("other_kind", { statement, answer });
  else if (canonicalKey(rec.structure) === canonicalKey(seedRec.structure)) push("same_as_seed", { statement, answer });
  else if (bank.has(canonicalKey(rec.structure))) push("bank_duplicate", { statement, answer });
  else push("ok", { statement, answer });
}

const count = (rs: typeof results) => Object.fromEntries(Object.entries(rs.reduce<Record<string, number>>((m, x) => ((m[x.verdict] = (m[x.verdict] ?? 0) + 1), m), {})).sort());
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "—");
const inScope = results.filter((x) => !["invalid_json", "out_of_scope"].includes(x.verdict));
const okN = results.filter((x) => x.verdict === "ok").length;
const recognized = inScope.filter((x) => x.verdict !== "not_recognized");
const answered = recognized.filter((x) => x.verdict !== "unsolvable");
const correct = answered.filter((x) => x.verdict !== "wrong_answer");

const report = {
  input,
  vi: {
    total: results.length,
    verdicts: count(results),
    by_relation: Object.fromEntries(["rule", "template"].map((rel) => [rel, count(results.filter((x) => x.relation === rel))])),
    rates: {
      json_valid: pct(results.length - (count(results).invalid_json ?? 0), results.length),
      in_scope_of_verifier: pct(inScope.length, results.length),
      recognized_of_in_scope: pct(recognized.length, inScope.length),
      answer_correct_of_solvable: pct(correct.length, answered.length),
      fully_valid_of_in_scope: pct(okN, inScope.length),
    },
  },
  en: { total: enTotal, json_valid: pct(enValid, enTotal) },
  failures: results.filter((x) => !["ok", "out_of_scope"].includes(x.verdict)).slice(0, 15),
  examples_ok: results.filter((x) => x.verdict === "ok").slice(0, 8),
};
writeFileSync(input.replace(/samples\.jsonl$/, "verify_report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ vi: report.vi, en: report.en }, null, 2));
console.log("\nVí dụ lỗi:");
for (const f of report.failures.slice(0, 8)) console.log(` [${f.verdict}] ${f.statement ?? ""} → ${f.answer ?? ""}${f.expected ? ` (đúng: ${f.expected})` : ""}`);
console.log("\nVí dụ đạt:");
for (const f of report.examples_ok.slice(0, 6)) console.log(` ✓ ${f.statement} → ${f.answer}`);
