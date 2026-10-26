import { CircleCheck, CircleX } from "lucide-react";
import { MathText } from "@/components/math";
import { cn } from "@/lib/utils";
import type { AttemptResult } from "@/types/api";

export function FeedbackPanel({ result }: { result: AttemptResult }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        result.is_correct ? "border-success-200 bg-success-50" : "border-danger-200 bg-danger-50",
      )}
    >
      {result.is_correct ? (
        <p className="flex items-center gap-2 font-semibold text-success-700">
          <CircleCheck className="size-5" aria-hidden /> Chính xác!
        </p>
      ) : (
        <>
          <p className="flex items-center gap-2 font-semibold text-danger-700">
            <CircleX className="size-5" aria-hidden /> Chưa đúng
          </p>
          <p className="mt-2 text-ink">
            Đáp án đúng: <MathText text={result.correct_answer_display} className="font-medium" />
          </p>
        </>
      )}

      <div className="mt-4 rounded-xl bg-white/80 p-4">
        <p className="mb-2 text-sm font-semibold text-muted">Lời giải</p>
        <ol className="list-inside list-decimal space-y-1.5 marker:text-muted">
          {result.solution.map((step, i) => (
            <li key={i}>
              <MathText text={step} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
