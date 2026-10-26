"use client";

import { memo } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { MathText } from "@/components/math";
import { Badge } from "@/components/ui/badge";
import { ChoiceAnswer, NumberAnswer } from "@/features/practice";
import { cn, difficultyLevel } from "@/lib/utils";
import type { ExamAnswer, ExamQuestion, ExamResultItem } from "@/types/api";
import { TrueFalseAnswer } from "./TrueFalseAnswer";

interface Props {
  question: ExamQuestion;
  answer: ExamAnswer | undefined;
  onAnswer: (questionId: string, value: ExamAnswer) => void;
  result?: ExamResultItem;
  /** Điểm tối đa của câu (chỉ hiện ở đề thi chính thức). */
  maxPoints?: number;
}

// memo: đề 100 câu, gõ một ô không được render lại (và chạy lại KaTeX) cho 99 câu còn lại.
export const QuestionCard = memo(function QuestionCard({ question: q, answer, onAnswer, result, maxPoints }: Props) {
  const graded = result !== undefined;
  const level = difficultyLevel(q.difficulty);

  return (
    <article
      id={`cau-${q.index}`}
      data-index={q.index}
      className={cn(
        "scroll-mt-32 rounded-2xl border bg-white p-5 shadow-sm shadow-brand-100/60 sm:p-6 xl:scroll-mt-6",
        !graded && "border-line",
        graded && (result.is_correct ? "border-success-200" : "border-danger-200"),
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-lg px-2.5 py-1 text-sm font-bold",
            !graded && "bg-brand-50 text-brand-700",
            graded && (result.is_correct ? "bg-success-600 text-white" : "bg-danger-600 text-white"),
          )}
        >
          Câu {q.index}
        </span>
        <span className="text-xs text-muted">{q.template.name}</span>
        <span className="ml-auto flex items-center gap-2">
          {maxPoints !== undefined && (
            <span className="text-xs font-medium text-muted">
              {graded ? `${(result.points * maxPoints).toLocaleString("vi-VN")}/` : ""}
              {maxPoints.toLocaleString("vi-VN")} điểm
            </span>
          )}
          <Badge tone={level.tone}>{level.label}</Badge>
        </span>
      </header>

      <MathText text={q.statement} className="mt-3 block text-[17px] leading-relaxed" />

      <div className="mt-4">
        {q.type === "choice" && (
          <ChoiceAnswer
            name={q.id}
            choices={(q.choices ?? []).map((c) => ({ key: c.key, content: <MathText text={c.content} /> }))}
            value={answer?.type === "choice" ? answer.value : ""}
            onChange={(v) => onAnswer(q.id, { type: "choice", value: v })}
            disabled={graded}
            correctKey={result?.correct_answer.type === "choice" ? result.correct_answer.value : undefined}
          />
        )}
        {q.type === "true_false" && (
          <TrueFalseAnswer
            statements={q.statements ?? []}
            value={answer?.type === "true_false" ? answer.value : {}}
            onChange={(v) => onAnswer(q.id, { type: "true_false", value: v })}
            disabled={graded}
            correct={result?.correct_answer.type === "true_false" ? result.correct_answer.value : undefined}
          />
        )}
        {q.type === "number" && (
          <NumberAnswer
            label={`Đáp án câu ${q.index}`}
            prefix={q.answer_prefix}
            value={answer?.type === "number" ? answer.value : ""}
            onChange={(v) => onAnswer(q.id, { type: "number", value: v })}
            disabled={graded}
          />
        )}
      </div>

      {graded && (
        <div className="mt-4 space-y-2">
          <p className={cn("flex flex-wrap items-center gap-x-2 text-sm font-semibold", result.is_correct ? "text-success-700" : "text-danger-700")}>
            {result.is_correct ? <CircleCheck className="size-4.5" aria-hidden /> : <CircleX className="size-4.5" aria-hidden />}
            {result.is_correct ? "Đúng" : answer ? "Sai" : "Chưa làm"}
            {q.type === "true_false" && !result.is_correct && result.points > 0 && (
              <span className="font-normal text-muted">
                (đúng một phần, được {(result.points * (maxPoints ?? 1)).toLocaleString("vi-VN")} điểm)
              </span>
            )}
          </p>
          {!result.is_correct && q.type !== "true_false" && (
            <p className="text-sm text-ink">
              Đáp án đúng: <MathText text={result.correct_answer_display} className="font-medium" />
            </p>
          )}
          <details className="rounded-xl bg-surface px-4 py-2.5 text-sm">
            <summary className="cursor-pointer font-medium text-brand-700">Xem lời giải</summary>
            <ol className="mt-2 list-inside list-decimal space-y-1 marker:text-muted">
              {result.solution.map((step, i) => (
                <li key={i}>
                  <MathText text={step} />
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </article>
  );
});
