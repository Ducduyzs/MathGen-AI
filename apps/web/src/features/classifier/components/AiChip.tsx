import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClassifierPrediction } from "@/types/api";

export function aiSummary(p: ClassifierPrediction) {
  return `${p.topic_label} · ${p.grade ? `lớp ${p.grade}` : p.grade_band_label} · ${p.level}`;
}

/** "AI: Hình học · lớp 9 · Thông hiểu (97%)": nhận định của mô hình phân loại, khác với nhận dạng dạng bài của bộ giải. */
export function AiChip({ prediction: p, className }: { prediction: ClassifierPrediction | null | undefined; className?: string }) {
  if (!p) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200 ring-inset", className)}
      title={`Mô hình phân loại: chủ đề ${Math.round(p.topic_confidence * 100)}%, cấp ${Math.round(p.grade_band_confidence * 100)}%, lớp ${Math.round(p.grade_confidence * 100)}%, độ khó ${p.difficulty}`}
    >
      <Sparkles className="size-3" aria-hidden />
      AI: {aiSummary(p)} ({Math.round(p.topic_confidence * 100)}%)
    </span>
  );
}
