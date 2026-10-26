import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ExamAnswer, ExamKind, ExamQuestion, ExamResultItem } from "@/types/api";
import { answerState, sectionLabel, sectionsOf } from "../model";

interface Props {
  kind: ExamKind;
  questions: ExamQuestion[];
  answers: Record<string, ExamAnswer>;
  results: Map<string, ExamResultItem> | null;
  activeIndex: number;
  onJump: (index: number) => void;
  footer?: ReactNode;
}

/**
 * Bảng ô số thứ tự câu. Trước khi nộp: xanh dương = đã làm, viền xanh nhạt = làm dở, trắng = chưa làm.
 * Sau khi nộp: xanh lá = đúng, đỏ = sai hoặc bỏ trống.
 */
export function QuestionNav({ kind, questions, answers, results, activeIndex, onJump, footer }: Props) {
  const done = questions.filter((q) => answerState(q, answers[q.id]) === "done").length;

  return (
    <nav aria-label="Bảng câu hỏi" className="space-y-4">
      {!results && (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-ink">Đã làm</span>
            <span className="font-medium text-brand-700 tabular-nums">
              {done}/{questions.length}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${(done / questions.length) * 100}%` }} />
          </div>
        </div>
      )}

      {sectionsOf(questions).map((section) => (
        <div key={section.questions[0].id}>
          <p className="mb-2 text-xs font-semibold text-muted">{sectionLabel(section.type, kind)}</p>
          <ol className="grid grid-cols-5 gap-1.5">
            {section.questions.map((q) => {
              const r = results?.get(q.id);
              const state = answerState(q, answers[q.id]);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onJump(q.index)}
                    aria-label={`Câu ${q.index}${r ? (r.is_correct ? ", đúng" : ", sai") : state === "done" ? ", đã làm" : ", chưa làm"}`}
                    aria-current={activeIndex === q.index ? "true" : undefined}
                    className={cn(
                      "grid h-9 w-full place-items-center rounded-md border text-xs font-semibold tabular-nums transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none",
                      r
                        ? r.is_correct
                          ? "border-success-600 bg-success-600 text-white"
                          : "border-danger-600 bg-danger-600 text-white"
                        : state === "done"
                          ? "border-brand-500 bg-brand-500 text-white"
                          : state === "partial"
                            ? "border-brand-300 bg-brand-50 text-brand-800"
                            : "border-line bg-white text-muted hover:border-brand-300",
                      activeIndex === q.index && "ring-2 ring-brand-300 ring-offset-1",
                    )}
                  >
                    {q.index}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {results ? (
          <>
            <Legend className="bg-success-600" label="Đúng" />
            <Legend className="bg-danger-600" label="Sai / bỏ trống" />
          </>
        ) : (
          <>
            <Legend className="bg-brand-500" label="Đã làm" />
            <Legend className="border border-brand-300 bg-brand-50" label="Làm dở" />
            <Legend className="border border-line bg-white" label="Chưa làm" />
          </>
        )}
      </ul>

      {footer}
    </nav>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", className)} aria-hidden />
      {label}
    </li>
  );
}
