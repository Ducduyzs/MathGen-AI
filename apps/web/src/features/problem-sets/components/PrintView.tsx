"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { MathText } from "@/components/math";
import { ErrorState } from "@/components/layout/States";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sectionLabel } from "@/features/exams/model";
import { errorMessage } from "@/lib/api/errors";
import { cn, plainText } from "@/lib/utils";
import type { SetQuestion } from "@/types/api";
import { useProblemSet } from "../api";

/** Phương án ngắn thì xếp 4 cột như đề in, dài thì 2 cột. */
const SHORT_CHOICE = 18;

function Choices({ q }: { q: SetQuestion }) {
  const choices = q.choices ?? [];
  const short = choices.every((c) => plainText(c.content).length <= SHORT_CHOICE);
  return (
    <ul className={cn("mt-1.5 grid gap-x-6 gap-y-1", short ? "grid-cols-2 sm:grid-cols-4 print:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 print:grid-cols-2")}>
      {choices.map((c) => (
        <li key={c.key}>
          <strong>{c.key}.</strong> <MathText text={c.content} />
        </li>
      ))}
    </ul>
  );
}

function answerKey(q: SetQuestion) {
  if (q.answer.type === "choice") return q.answer.value;
  if (q.answer.type === "true_false") {
    const v = q.answer.value;
    return Object.keys(v)
      .sort()
      .map((k) => `${k}) ${v[k] ? "Đ" : "S"}`)
      .join("  ");
  }
  return null;
}

/** Bản in của bộ đề: đề cho học sinh, đáp án và lời giải (tùy chọn) ở trang riêng. Dùng "In / Lưu PDF" của trình duyệt. */
export function PrintView({ id }: { id: string }) {
  const { data: set, isPending, isError, error, refetch } = useProblemSet(id);
  const [withKey, setWithKey] = useState(true);
  const [withSolution, setWithSolution] = useState(false);

  if (isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-white p-4 print:hidden">
        <Link href={`/teacher/problem-sets/${set.id}`} className="text-sm text-muted hover:text-brand-700">
          ← Soạn bộ đề
        </Link>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-brand-600" checked={withKey} onChange={(e) => setWithKey(e.target.checked)} />
          Kèm đáp án
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-brand-600"
            checked={withSolution}
            onChange={(e) => setWithSolution(e.target.checked)}
          />
          Kèm lời giải
        </label>
        <Button className="ml-auto" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> In / Lưu PDF
        </Button>
      </div>

      <article className="rounded-2xl border border-line bg-white p-6 text-[15px] leading-relaxed text-ink sm:p-10 print:rounded-none print:border-0 print:p-0">
        <header className="border-b border-ink/20 pb-4 text-center">
          <h1 className="text-xl font-bold tracking-tight uppercase">{set.title}</h1>
          {set.description && <p className="mt-1 text-sm">{set.description}</p>}
          <p className="mt-1 text-sm">Số câu: {set.size} · Thời gian làm bài: ........ phút</p>
          <div className="mt-4 grid gap-2 text-left text-sm sm:grid-cols-[1fr_12rem] print:grid-cols-[1fr_12rem]">
            <p>Họ và tên: ..........................................................</p>
            <p>Lớp: ......................</p>
          </div>
        </header>

        <ol className="mt-5 space-y-4">
          {set.questions.map((q, i) => (
            <li key={q.key} className="break-inside-avoid">
              {(i === 0 || set.questions[i - 1].type !== q.type) && (
                <h2 className="mt-2 mb-2 text-sm font-bold uppercase">{sectionLabel(q.type, "practice")}</h2>
              )}
              <p>
                <strong>Câu {i + 1}.</strong> <MathText text={q.statement} />
              </p>
              {q.type === "choice" && <Choices q={q} />}
              {q.type === "true_false" && (
                <ul className="mt-1.5 space-y-1">
                  {(q.statements ?? []).map((st) => (
                    <li key={st.key} className="flex gap-2">
                      <span>{st.key})</span>
                      <MathText text={st.content} className="min-w-0 flex-1" />
                    </li>
                  ))}
                </ul>
              )}
              {q.type === "number" && <p className="mt-1.5">Đáp số: ..............................</p>}
            </li>
          ))}
        </ol>

        {(withKey || withSolution) && (
          <section className="mt-10 border-t border-ink/20 pt-6 print:break-before-page">
            <h2 className="text-center text-lg font-bold uppercase">Đáp án{withSolution ? " và lời giải" : ""}</h2>
            {withKey && (
              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-ink/30 px-2 py-1 text-left">Câu</th>
                    <th className="border border-ink/30 px-2 py-1 text-left">Đáp án</th>
                  </tr>
                </thead>
                <tbody>
                  {set.questions.map((q, i) => (
                    <tr key={q.key}>
                      <td className="border border-ink/30 px-2 py-1 tabular-nums">{i + 1}</td>
                      <td className="border border-ink/30 px-2 py-1">{answerKey(q) ?? <MathText text={q.answer_display} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {withSolution && (
              <ol className="mt-5 space-y-3">
                {set.questions.map((q, i) => (
                  <li key={q.key} className="break-inside-avoid">
                    <strong>Câu {i + 1}.</strong>
                    <ol className="mt-1 list-inside list-decimal space-y-0.5 text-sm">
                      {q.solution.map((step, j) => (
                        <li key={j}>
                          <MathText text={step} />
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </article>
    </div>
  );
}
