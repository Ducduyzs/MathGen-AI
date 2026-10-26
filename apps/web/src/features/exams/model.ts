import { parseNumber } from "@/lib/math-input";
import type { ExamAnswer, ExamKind, ExamMode, ExamQuestion, ExamQuestionType } from "@/types/api";

export const EXAM_SIZES: Record<ExamMode, number[]> = {
  choice: [10, 20, 40, 100],
  written: [5, 10, 20, 40],
};

/** Phút gợi ý cho mỗi câu, để ước lượng thời gian làm đề. */
export const MINUTES_PER_QUESTION: Record<ExamMode, number> = { choice: 1.5, written: 3 };

const SECTION_LABEL: Record<ExamKind, Record<ExamQuestionType, string>> = {
  practice: {
    choice: "Phần I · Trắc nghiệm A/B/C/D",
    true_false: "Phần II · Trắc nghiệm Đúng/Sai",
    number: "Tự luận · Điền đáp số",
  },
  official: {
    choice: "Phần I · Trắc nghiệm nhiều phương án lựa chọn",
    true_false: "Phần II · Trắc nghiệm Đúng/Sai",
    number: "Phần III · Trắc nghiệm trả lời ngắn",
  },
};

export const sectionLabel = (type: ExamQuestionType, kind: ExamKind) => SECTION_LABEL[kind][type];

/**
 * Cấu trúc đề thi tốt nghiệp THPT môn Toán (từ 2025): 22 câu, 90 phút, thang 10.
 * Phần II chấm theo số ý đúng: 1 ý 0,1 · 2 ý 0,25 · 3 ý 0,5 · 4 ý 1 điểm.
 */
export const THPT_STRUCTURE = [
  { part: "I", type: "choice", label: "Nhiều phương án lựa chọn", count: 12, points: 0.25, note: "Chọn 1 trong 4 phương án A, B, C, D" },
  { part: "II", type: "true_false", label: "Đúng/Sai", count: 4, points: 1, note: "Mỗi câu 4 ý a, b, c, d; chấm theo số ý đúng" },
  { part: "III", type: "number", label: "Trả lời ngắn", count: 6, points: 0.5, note: "Điền đáp số" },
] as const;

export const THPT_TOPICS = [
  "Ứng dụng đạo hàm: đơn điệu, cực trị, tiệm cận, tối ưu",
  "Nguyên hàm – Tích phân – Diện tích",
  "Mũ – Logarit",
  "Hình học không gian: thể tích",
  "Tọa độ Oxyz: điểm, vectơ, mặt phẳng, mặt cầu",
  "Xác suất cổ điển, xác suất có điều kiện",
  "Thống kê: mẫu số liệu ghép nhóm",
  "Dãy số – Cấp số cộng – Cấp số nhân",
];

/** Điểm tối đa của một câu trong đề thi chính thức. */
export function maxPoints(type: ExamQuestionType) {
  return THPT_STRUCTURE.find((p) => p.type === type)!.points;
}

export type AnswerState = "empty" | "partial" | "done";

export function answerState(q: ExamQuestion, a: ExamAnswer | undefined): AnswerState {
  if (!a) return "empty";
  if (a.type === "choice") return a.value ? "done" : "empty";
  if (a.type === "number") {
    if (!a.value.trim()) return "empty";
    return parseNumber(a.value) === null ? "partial" : "done";
  }
  const n = Object.keys(a.value).length;
  if (n === 0) return "empty";
  return n >= (q.statements?.length ?? 4) ? "done" : "partial";
}

/** Gom các câu liên tiếp cùng loại thành một phần của đề. */
export function sectionsOf(questions: ExamQuestion[]) {
  const out: { type: ExamQuestionType; questions: ExamQuestion[] }[] = [];
  for (const q of questions) {
    const last = out[out.length - 1];
    if (last?.type === q.type) last.questions.push(q);
    else out.push({ type: q.type, questions: [q] });
  }
  return out;
}

export const draftKey = (examId: string) => `exam-draft:${examId}`;

export function formatScore(score: number) {
  return score.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}
