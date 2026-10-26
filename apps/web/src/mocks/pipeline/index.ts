// Pipeline: văn bản đề → tách câu → nhận dạng cấu trúc → giải & kiểm chứng → chống trùng.
// Đây là bản tham chiếu chạy trong mock; backend Python (module generation_verification) làm tương đương với SymPy.
import type { ExtractedItem, Skill } from "@/types/api";
import { canonicalKey, canonicalLatex, estimateDifficulty, hashKey } from "./canonical";
import { rulesFor } from "./generate";
import { parseRelation } from "./parse";
import { coef, degM, degX, isConst, constOf } from "./poly";
import { div, eq, neg, plain } from "./rational";
import { solve, SolveError, type Solved } from "./solve";
import { splitQuestions } from "./split";
import { generalForm, KIND_LABEL, KIND_SKILL, mathSegments, recognize, type Structure, toDisplay } from "./structure";

export { generateVariants, type DedupeIndex } from "./generate";
export { recognize } from "./structure";
export { canonicalKey } from "./canonical";

export interface PipelineItem extends ExtractedItem {
  /** Cấu trúc nội bộ (không trả ra API) để sinh biến thể. */
  _structure: Structure | null;
  _key: string | null;
}

/** Phương án A/B/C/D nào khớp lời giải: so đáp số, hoặc so bất đẳng thức một biến (x > 4, m < 25/4). */
function matchChoice(choices: { key: string; content: string }[], solved: Solved): string | null {
  for (const c of choices) {
    const seg = mathSegments(c.content)[0] ?? c.content;
    try {
      const { P, rel } = parseRelation(seg);
      if (!rel) {
        if (solved.short && isConst(P) && eq(constOf(P), solved.short)) return c.key;
        continue;
      }
      // Một biến (x hoặc m), bậc nhất: v rel giá trị
      const v = degM(P) ? "m" : "x";
      if (degX(P) + degM(P) !== 1) continue;
      const k = v === "m" ? coef(P, 0, 1) : coef(P, 1);
      const value = div(neg(coef(P, 0)), k);
      const flip: Record<string, string> = { "<": ">", ">": "<", "<=": ">=", ">=": "<=", "=": "=" };
      const r = k.n < 0 ? flip[rel] : rel;
      if (r === "=" && solved.short && eq(value, solved.short)) return c.key;
      if (solved.key === `${v}${r}${plain(value)}`) return c.key;
    } catch {
      // phương án không phải biểu thức: bỏ qua
    }
  }
  return null;
}

export function runPipeline(text: string, sourceId: string, bank: Map<string, string>, skills: Skill[]): PipelineItem[] {
  const seen = new Map<string, string>();
  return splitQuestions(text).map((rq): PipelineItem => {
    const id = `${sourceId}_c${rq.index}`;
    const base: PipelineItem = {
      id,
      index: rq.index,
      raw_text: rq.raw,
      statement: toDisplay(rq.stem),
      choices: rq.choices,
      status: "unrecognized",
      reason: null,
      structure: null,
      answer_display: null,
      solution: [],
      grade: null,
      skill: null,
      difficulty: null,
      confidence: 0,
      checks: [],
      duplicate_of: null,
      matched_choice: null,
      rules: [],
      _structure: null,
      _key: null,
    };

    const rec = recognize(rq.stem);
    if (!rec.ok) return { ...base, reason: rec.reason };
    const s = rec.structure;

    let solved: Solved;
    try {
      solved = solve(s);
    } catch (e) {
      if (e instanceof SolveError) return { ...base, reason: `Nhận ra dạng ${KIND_LABEL[s.kind].toLowerCase()} nhưng chưa giải được: ${e.message}.` };
      throw e;
    }

    const key = canonicalKey(s);
    const bankDup = bank.get(key);
    const innerDup = seen.get(key);
    if (!innerDup) seen.set(key, `Câu ${rq.index}`);
    const matched = rq.choices.length ? matchChoice(rq.choices, solved) : null;
    const gf = generalForm(s);
    const meta = KIND_SKILL[s.kind];

    return {
      ...base,
      status: "recognized",
      structure: {
        kind: s.kind,
        kind_label: KIND_LABEL[s.kind],
        general_form: gf.template,
        params: gf.params,
        canonical: canonicalLatex(s),
        hash: hashKey(key),
      },
      answer_display: solved.display,
      solution: solved.steps,
      grade: meta.grade,
      skill: skills.find((sk) => sk.code === meta.skill) ?? null,
      difficulty: estimateDifficulty(s),
      confidence: rec.confidence,
      checks: [
        { label: "Đọc được biểu thức và nhận dạng dạng bài", passed: true },
        ...solved.checks,
        ...(rq.choices.length
          ? [{ label: matched ? `Lời giải khớp phương án ${matched} trong đề` : "Không phương án nào khớp lời giải — kiểm tra lại đề", passed: !!matched }]
          : []),
        { label: bankDup ? `Trùng bài ${bankDup} trong ngân hàng` : "Không trùng ngân hàng bài", passed: !bankDup },
        ...(innerDup ? [{ label: `Trùng với ${innerDup} trong cùng đề`, passed: false }] : []),
      ],
      duplicate_of: bankDup ?? innerDup ?? null,
      matched_choice: matched,
      rules: rulesFor(s.kind),
      _structure: s,
      _key: key,
    };
  });
}

/** Chỉ mục chống trùng cho ngân hàng: khóa chuẩn → mã bài. */
export function buildBankIndex(problems: { id: string; statement: string }[]) {
  const index = new Map<string, string>();
  for (const p of problems) {
    const rec = recognize(p.statement);
    if (rec.ok) index.set(canonicalKey(rec.structure), p.id);
  }
  return index;
}
