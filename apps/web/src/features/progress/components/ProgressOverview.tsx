"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, Flame, History } from "lucide-react";
import { MathText } from "@/components/math";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { percent, timeAgo } from "@/lib/utils";
import { useProgress, useRecentAttempts } from "../api";
import { SkillBars } from "./SkillBars";

export function ProgressOverview() {
  const progress = useProgress();

  if (progress.isPending) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  if (progress.isError) return <ErrorState message={errorMessage(progress.error)} onRetry={() => progress.refetch()} />;

  const { skills, total_attempts, correct_attempts, daily_goal, today_attempts, streak_days } = progress.data;
  // Kỹ năng đã luyện xếp từ yếu đến mạnh; kỹ năng chưa luyện đặt cuối.
  const sorted = [...skills].sort((a, b) => Number(a.n_attempts === 0) - Number(b.n_attempts === 0) || a.score - b.score);
  const weakest = sorted.find((s) => s.n_attempts > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Mục tiêu hôm nay"
          value={`${Math.min(today_attempts, daily_goal)}/${daily_goal} bài`}
          footer={
            <span className="flex items-center gap-1 text-sm text-muted">
              <Flame className="size-3.5 text-warning-700" aria-hidden /> Chuỗi {streak_days} ngày
            </span>
          }
        />
        <StatTile label="Tổng số bài đã làm" value={String(total_attempts)} />
        <StatTile label="Tỷ lệ đúng" value={total_attempts ? percent(correct_attempts / total_attempts) : "—"} />
        <StatTile
          label="Cần luyện nhất"
          value={weakest?.name ?? "—"}
          footer={
            weakest && (
              <Link href={`/practice?skill=${weakest.code}`} className="text-sm font-medium text-brand-700 hover:underline">
                Luyện ngay →
              </Link>
            )
          }
        />
      </div>

      <Card className="p-5 sm:p-6">
        <CardTitle>Hồ sơ năng lực</CardTitle>
        <CardDescription className="mt-1">
          Sắp xếp từ yếu đến mạnh qua 4 mức: Mới bắt đầu → Đang luyện → Thành thạo → Vững vàng. Đúng nhờ gợi ý được cộng ít điểm hơn.
        </CardDescription>
        <div className="mt-5">
          <SkillBars skills={sorted} />
        </div>
      </Card>

      <RecentAttempts />
    </div>
  );
}

function StatTile({ label, value, footer }: { label: string; value: string; footer?: ReactNode }) {
  return (
    <Card className="bg-linear-to-br from-white to-brand-50 p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {footer && <div className="mt-1">{footer}</div>}
    </Card>
  );
}

function RecentAttempts() {
  const attempts = useRecentAttempts();

  if (attempts.isPending) return <Skeleton className="h-48 rounded-2xl" />;
  if (attempts.isError) return <ErrorState message={errorMessage(attempts.error)} onRetry={() => attempts.refetch()} />;
  if (attempts.data.length === 0) {
    return <EmptyState icon={History} title="Chưa có bài làm nào" description="Bắt đầu luyện tập để xem lịch sử tại đây." />;
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>Bài làm gần đây</CardTitle>
      <ul className="mt-4 divide-y divide-line">
        {attempts.data.map((a) => (
          <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            {a.is_correct ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success-600" aria-label="Đúng" />
            ) : (
              <CircleX className="mt-0.5 size-5 shrink-0 text-danger-600" aria-label="Sai" />
            )}
            <div className="min-w-0 flex-1">
              <MathText text={a.statement} className="line-clamp-1 block text-ink" />
              <p className="mt-0.5 text-xs text-muted">
                {a.skill.name} · {timeAgo(a.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
