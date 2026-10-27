"use client";

import { useMemo, useState } from "react";
import { Flame, Medal, Trophy } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatScore } from "@/features/exams/model";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/types/api";
import { useLeaderboard } from "../api";

const BOARDS = {
  score: {
    label: "Điểm bài tập",
    hint: "Điểm trung bình các bài giao đã nộp",
    sort: (a: LeaderboardRow, b: LeaderboardRow) =>
      (b.average_score ?? -1) - (a.average_score ?? -1) || b.assignments_done - a.assignments_done || b.week_problems - a.week_problems,
  },
  week: {
    label: "Chăm chỉ tuần này",
    hint: "Số bài đã làm trong 7 ngày gần nhất (luyện tập và làm đề)",
    sort: (a: LeaderboardRow, b: LeaderboardRow) => b.week_problems - a.week_problems || b.streak_days - a.streak_days,
  },
} as const;

const MEDAL = ["text-amber-500", "text-slate-400", "text-orange-600"];

export function Leaderboard({ classId }: { classId: string }) {
  const { data, isPending, isError, error, refetch } = useLeaderboard(classId);
  const [board, setBoard] = useState<keyof typeof BOARDS>("score");
  const rows = useMemo(() => [...(data ?? [])].sort(BOARDS[board].sort), [data, board]);

  if (isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  if (!rows.length) return <EmptyState icon={Trophy} title="Lớp chưa có học sinh" description="Bảng xếp hạng hiện khi học sinh vào lớp." />;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        {(Object.keys(BOARDS) as (keyof typeof BOARDS)[]).map((k) => (
          <Chip key={k} size="sm" selected={k === board} onClick={() => setBoard(k)}>
            {BOARDS[k].label}
          </Chip>
        ))}
        <p className="w-full text-xs text-muted sm:ml-auto sm:w-auto">{BOARDS[board].hint}</p>
      </div>
      <ol className="divide-y divide-line">
        {rows.map((r, i) => (
          <li key={r.id} className={cn("flex items-center gap-3 px-4 py-3", r.is_me && "bg-brand-50")}>
            <span className="grid w-8 shrink-0 place-items-center text-sm font-bold text-muted tabular-nums">
              {i < 3 ? <Medal className={cn("size-5", MEDAL[i])} aria-label={`Hạng ${i + 1}`} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">
                {r.full_name}
                {r.is_me && <span className="ml-2 text-xs font-semibold text-brand-700">(Bạn)</span>}
              </span>
              <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                <span>{r.assignments_done} bài đã nộp</span>
                {r.streak_days > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Flame className="size-3.5 text-warning-700" aria-hidden /> {r.streak_days} ngày liên tiếp
                  </span>
                )}
              </span>
            </span>
            <span className="text-right">
              {board === "score" ? (
                <>
                  <span className="block font-semibold text-ink tabular-nums">{r.average_score != null ? formatScore(r.average_score) : "–"}</span>
                  <span className="text-xs text-muted">điểm TB</span>
                </>
              ) : (
                <>
                  <span className="block font-semibold text-ink tabular-nums">{r.week_problems}</span>
                  <span className="text-xs text-muted">bài / 7 ngày</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
