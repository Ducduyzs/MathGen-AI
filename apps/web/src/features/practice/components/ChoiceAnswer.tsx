import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChoiceOption {
  key: string;
  /** Nội dung đã render (thường là <MathText>), để component không phải tự kéo KaTeX vào bundle. */
  content: ReactNode;
}

interface Props {
  choices: ChoiceOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  /** Có sau khi nộp: tô xanh đáp án đúng, tô đỏ lựa chọn sai. */
  correctKey?: string;
  name?: string;
}

export function ChoiceAnswer({ choices, value, onChange, disabled, correctKey, name = "choice" }: Props) {
  return (
    <div role="radiogroup" aria-label="Chọn đáp án" className="grid gap-3 sm:grid-cols-2">
      {choices.map((c) => {
        const selected = value === c.key;
        const isCorrect = correctKey === c.key;
        const isWrong = correctKey !== undefined && selected && !isCorrect;
        return (
          <label
            key={c.key}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 transition-colors",
              "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-100",
              disabled ? "cursor-default" : "cursor-pointer hover:border-brand-300",
              selected ? "border-brand-500 bg-brand-50" : "border-line",
              isCorrect && "border-success-600 bg-success-50",
              isWrong && "border-danger-600 bg-danger-50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={c.key}
              checked={selected}
              onChange={() => onChange(c.key)}
              disabled={disabled}
              className="sr-only"
            />
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                selected ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted",
                isCorrect && "border-success-600 bg-success-600 text-white",
                isWrong && "border-danger-600 bg-danger-600 text-white",
              )}
            >
              {c.key}
            </span>
            <span className="text-[15px]">{c.content}</span>
          </label>
        );
      })}
    </div>
  );
}
