"use client";

import { memo, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, RefreshCw, Trash2 } from "lucide-react";
import { MathText } from "@/components/math";
import { Badge } from "@/components/ui/badge";
import { cn, difficultyLevel } from "@/lib/utils";
import type { SetQuestion } from "@/types/api";
import { TYPE_LABEL } from "../model";

interface Props {
  q: SetQuestion;
  index: number;
  total: number;
  busy: boolean;
  onMove: (key: string, delta: -1 | 1) => void;
  onRegenerate: (key: string) => void;
  onRemove: (key: string) => void;
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Một câu trong bộ đề: đề, phương án (đánh dấu đáp án đúng), lời giải và các thao tác sắp xếp / đổi số liệu / xóa. */
export const SetQuestionItem = memo(function SetQuestionItem({ q, index, total, busy, onMove, onRegenerate, onRemove }: Props) {
  const level = difficultyLevel(q.difficulty);
  const answer = q.answer;

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-sm shadow-brand-100/60 sm:p-5">
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">Câu {index}</span>
        <Badge tone="neutral">{TYPE_LABEL[q.type]}</Badge>
        <Badge tone={level.tone}>{level.label}</Badge>
        <span className="min-w-0 truncate text-xs text-muted">{q.template.name}</span>
        <span className="ml-auto flex items-center">
          <ToolButton label="Chuyển lên" onClick={() => onMove(q.key, -1)} disabled={busy || index === 1}>
            <ArrowUp className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton label="Chuyển xuống" onClick={() => onMove(q.key, 1)} disabled={busy || index === total}>
            <ArrowDown className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton label="Đổi số liệu" onClick={() => onRegenerate(q.key)} disabled={busy}>
            <RefreshCw className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton label="Xóa câu" onClick={() => onRemove(q.key)} disabled={busy}>
            <Trash2 className="size-4" aria-hidden />
          </ToolButton>
        </span>
      </header>

      <MathText text={q.statement} className="mt-3 block leading-relaxed" />

      {q.type === "choice" && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {(q.choices ?? []).map((c) => {
            const correct = answer.type === "choice" && answer.value === c.key;
            return (
              <li
                key={c.key}
                className={cn(
                  "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                  correct ? "border-success-200 bg-success-50" : "border-line",
                )}
              >
                <span className={cn("font-semibold", correct ? "text-success-700" : "text-muted")}>{c.key}.</span>
                <MathText text={c.content} className="min-w-0 flex-1" />
                {correct && <Check className="mt-0.5 size-4 shrink-0 text-success-600" aria-label="Đáp án đúng" />}
              </li>
            );
          })}
        </ul>
      )}

      {q.type === "true_false" && answer.type === "true_false" && (
        <ul className="mt-3 space-y-1.5">
          {(q.statements ?? []).map((st) => (
            <li key={st.key} className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-muted">{st.key})</span>
              <MathText text={st.content} className="min-w-0 flex-1" />
              <Badge tone={answer.value[st.key] ? "success" : "danger"}>{answer.value[st.key] ? "Đúng" : "Sai"}</Badge>
            </li>
          ))}
        </ul>
      )}

      {q.type === "number" && (
        <p className="mt-3 text-sm">
          <span className="text-muted">Đáp án: </span>
          <MathText text={q.answer_display} className="font-semibold text-success-700" />
        </p>
      )}

      <details className="mt-3 rounded-xl bg-surface px-4 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-brand-700">Lời giải</summary>
        <ol className="mt-2 list-inside list-decimal space-y-1 marker:text-muted">
          {q.solution.map((step, i) => (
            <li key={i}>
              <MathText text={step} />
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
});
