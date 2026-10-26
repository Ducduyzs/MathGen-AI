import { MathText } from "@/components/math";
import { cn } from "@/lib/utils";
import type { TFStatement } from "@/types/api";

interface Props {
  statements: TFStatement[];
  value: Record<string, boolean>;
  onChange: (value: Record<string, boolean>) => void;
  disabled?: boolean;
  /** Có sau khi nộp: đáp án đúng của từng ý. */
  correct?: Record<string, boolean>;
}

/** Câu Đúng/Sai kiểu đề mới: mỗi ý a, b, c, d chọn Đúng hoặc Sai. */
export function TrueFalseAnswer({ statements, value, onChange, disabled, correct }: Props) {
  return (
    <ul className="space-y-2">
      {statements.map((s) => {
        const picked = value[s.key];
        const graded = correct !== undefined;
        const right = graded && picked === correct[s.key];
        return (
          <li
            key={s.key}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2.5",
              !graded && "border-line",
              graded && (right ? "border-success-200 bg-success-50" : "border-danger-200 bg-danger-50"),
            )}
          >
            <span className="font-semibold text-brand-700">{s.key})</span>
            <MathText text={s.content} className="min-w-0 flex-1 basis-48" />
            <div role="radiogroup" aria-label={`Ý ${s.key}`} className="ml-auto flex gap-1.5">
              {[true, false].map((v) => {
                const selected = picked === v;
                return (
                  <button
                    key={String(v)}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => onChange({ ...value, [s.key]: v })}
                    className={cn(
                      "h-9 min-w-16 rounded-lg border px-3 text-sm font-semibold transition-colors",
                      "focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none disabled:cursor-default",
                      selected ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-muted hover:border-brand-300",
                      graded && correct[s.key] === v && !selected && "border-success-600 text-success-700",
                    )}
                  >
                    {v ? "Đúng" : "Sai"}
                  </button>
                );
              })}
            </div>
            {graded && !right && (
              <span className="w-full text-xs font-medium text-danger-700">Đáp án: {correct[s.key] ? "Đúng" : "Sai"}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
