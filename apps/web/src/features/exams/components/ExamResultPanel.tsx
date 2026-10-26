"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PartyPopper, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { Exam, ExamResult } from "@/types/api";
import { useCreateExam } from "../api";
import { EXAM_SIZES, formatScore } from "../model";

export function ExamResultPanel({ exam, result }: { exam: Exam; result: ExamResult }) {
  const router = useRouter();
  const create = useCreateExam();
  const [picking, setPicking] = useState(false);
  const wrong = result.total - result.correct;

  function start(body: Parameters<typeof create.mutate>[0]) {
    create.mutate(body, {
      onSuccess: (next) => router.push(`/exams/${next.id}`),
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  const tone = result.score >= 8 ? "text-success-700" : result.score >= 5 ? "text-brand-700" : "text-danger-700";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-6 bg-linear-to-br from-brand-50 to-white p-6">
        <div className="grid size-24 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-4 ring-brand-100">
          <div className="text-center leading-none">
            <span className={cn("text-3xl font-bold tabular-nums", tone)}>{formatScore(result.score)}</span>
            <span className="mt-1 block text-xs text-muted">/ 10 điểm</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-ink">{wrong === 0 ? "Hoàn hảo, đúng tất cả!" : "Đã chấm xong"}</h2>
          <p className="mt-1 text-muted">
            Đúng <strong className="text-success-700">{result.correct}</strong> · Sai hoặc bỏ trống{" "}
            <strong className="text-danger-700">{wrong}</strong> trên tổng {result.total} câu.
          </p>
          {result.wrong_templates.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Dạng bài cần ôn: <span className="text-ink">{result.wrong_templates.map((t) => t.name).join(", ")}</span>
            </p>
          )}
        </div>
      </div>

      {result.parts.length > 0 && (
        <dl className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
          {result.parts.map((p) => (
            <div key={p.label} className="px-3 py-3">
              <dt className="text-xs text-muted">{p.label}</dt>
              <dd className="mt-0.5 font-bold text-ink tabular-nums">
                {formatScore(p.earned)}
                <span className="font-normal text-muted">/{formatScore(p.max)}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="space-y-3 border-t border-line p-5">
        {wrong === 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <PartyPopper className="size-5 text-brand-500" aria-hidden />
            <span className="mr-auto text-sm text-muted">Thử đề dài hơn hoặc khó hơn nhé.</span>
            <Link href="/exams" className={buttonClasses()}>
              Tạo đề mới
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => start({ retry_of: exam.id })} loading={create.isPending && !picking}>
                <RotateCcw className="size-4" aria-hidden /> Làm lại {wrong} câu sai
              </Button>
              <Button variant="secondary" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
                <Sparkles className="size-4" aria-hidden /> Tạo đề mới từ dạng đã sai
              </Button>
              <Link href="/exams" className={buttonClasses({ variant: "ghost" })}>
                Đề khác
              </Link>
            </div>
            {picking && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
                <span className="text-sm text-muted">Số câu:</span>
                {EXAM_SIZES[exam.mode].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant="outline"
                    disabled={create.isPending}
                    onClick={() => start({ kind: "practice", mode: exam.mode, size: n, templates: result.wrong_templates.map((t) => t.code) })}
                  >
                    {n} câu
                  </Button>
                ))}
                <span className="w-full text-xs text-muted">
                  Đề ôn tập mới gồm {result.wrong_templates.length} dạng đã sai, số liệu được sinh lại.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
