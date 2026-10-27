import type { ExamQuestionType, ProblemSetSummary, TemplateInfo } from "@/types/api";

export const MAX_SET_QUESTIONS = 100;

export const TYPE_LABEL: Record<ExamQuestionType, string> = {
  choice: "A/B/C/D",
  true_false: "Đúng/Sai",
  number: "Điền đáp số",
};

/** "12 câu · 8 A/B/C/D · 4 điền đáp số" (bỏ loại không có). */
export function countsLabel(s: Pick<ProblemSetSummary, "size" | "counts">) {
  const parts = (Object.keys(TYPE_LABEL) as ExamQuestionType[])
    .filter((t) => s.counts[t] > 0)
    .map((t) => `${s.counts[t]} ${TYPE_LABEL[t].toLowerCase()}`);
  return [`${s.size} câu`, ...(parts.length > 1 ? parts : [])].join(" · ");
}

/** Dạng bài của đề ôn tập (Đại số 8–10) hay của đề thi THPT (có Phần I/II/III). */
export type TemplateGroup = "basic" | "thpt";

export const GROUP_LABEL: Record<TemplateGroup, string> = { basic: "Ôn tập Đại số 8–10", thpt: "Ôn thi THPT 10–12" };

export const groupOf = (t: TemplateInfo): TemplateGroup => (t.part ? "thpt" : "basic");
