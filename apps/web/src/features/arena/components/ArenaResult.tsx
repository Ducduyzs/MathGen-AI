"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Flame, Medal, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { errorMessage } from "@/lib/api/errors";
import { percent } from "@/lib/utils";
import type { ArenaItem, ArenaRun } from "@/types/api";
import { useStartRun } from "../api";
import { POOL_LABEL } from "../model";

function given(item: ArenaItem) {
  if (!item.given) return "Bỏ qua";
  return item.given.type === "true_false" ? "" : item.given.value;
}

/** Kết quả một lượt: điểm, kỷ lục, hạng tuần và từng câu đã làm. */
export function ArenaResult({ run }: { run: ArenaRun }) {
  const router = useRouter();
  const start = useStartRun();
  const history = run.history ?? [];

  function again() {
    start.mutate(
      { pool: run.pool, duration_minutes: run.duration_minutes },
      { onSuccess: (r) => router.replace(`/arena/${r.id}`), onError: (err) => toast.error(errorMessage(err)) },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/arena" className="text-sm text-muted hover:text-brand-700">
        ← Đấu trường
      </Link>

      <Card className="bg-linear-to-br from-white to-brand-50 p-6 text-center sm:p-8">
        <p className="text-sm text-muted">
          {POOL_LABEL[run.pool]} · {run.duration_minutes} phút
        </p>
        <p className="mt-2 text-5xl font-bold text-brand-700 tabular-nums">{run.score}</p>
        <p className="mt-1 text-muted">điểm</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {run.personal_best && (
            <Badge tone="success">
              <Sparkles className="size-3.5" aria-hidden /> Kỷ lục cá nhân mới
            </Badge>
          )}
          {run.week_rank != null && (
            <Badge>
              <Medal className="size-3.5" aria-hidden /> Hạng {run.week_rank} tuần này
            </Badge>
          )}
        </div>
        <dl className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted">Đúng</dt>
            <dd className="text-xl font-semibold text-ink tabular-nums">
              {run.correct}/{run.answered}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Tỉ lệ</dt>
            <dd className="text-xl font-semibold text-ink tabular-nums">{run.answered ? percent(run.correct / run.answered) : "–"}</dd>
          </div>
          <div>
            <dt className="text-muted">Chuỗi dài nhất</dt>
            <dd className="inline-flex items-center gap-1 text-xl font-semibold text-ink tabular-nums">
              <Flame className="size-4 text-warning-700" aria-hidden />
              {run.best_combo}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={again} loading={start.isPending}>
            <RotateCcw className="size-4" aria-hidden /> Chơi lại
          </Button>
          <Link href="/arena" className={buttonClasses({ variant: "outline" })}>
            Xem bảng xếp hạng
          </Link>
        </div>
      </Card>

      {history.length > 0 && (
        <Card className="p-5 sm:p-6">
          <CardTitle>Các câu đã làm</CardTitle>
          <ol className="mt-3 divide-y divide-line">
            {history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                {h.is_correct ? (
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-success-600" aria-label="Đúng" />
                ) : (
                  <CircleX className="mt-0.5 size-5 shrink-0 text-danger-600" aria-label="Sai" />
                )}
                <div className="min-w-0 flex-1">
                  <MathText text={h.statement} className="line-clamp-2 block text-sm text-ink" />
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                    <span>
                      Đáp án: <MathText text={h.answer_display} className="font-medium text-ink" />
                    </span>
                    {!h.is_correct && <span>Bạn chọn: {given(h)}</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink tabular-nums">{h.points ? `+${h.points}` : "0"}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
