"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/layout/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { POOL_LABEL } from "@/features/arena/model";
import { dueLabel, formatDateTime, isOpen, STATUS } from "@/features/classroom/model";
import { formatScore } from "@/features/exams/model";
import { SkillBars } from "@/features/progress";
import { errorMessage } from "@/lib/api/errors";
import { percent, timeAgo } from "@/lib/utils";
import { useChildReport, useRemoveChild } from "../api";
import { lastActiveLabel } from "../model";
import { ActivityChart } from "./ActivityChart";

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="bg-linear-to-br from-white to-brand-50 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

/** Phụ huynh xem việc học của con: hôm nay, 14 ngày, kỹ năng, bài lớp giao, đề đã làm, Đấu trường. */
export function ChildReportView({ id }: { id: string }) {
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useChildReport(id);
  const remove = useRemoveChild();
  const [confirming, setConfirming] = useState(false);

  if (isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const { child, progress, activity, exams, assignments, arena } = data;
  const skills = [...progress.skills].sort((a, b) => Number(a.n_attempts === 0) - Number(b.n_attempts === 0) || a.score - b.score);
  const open = assignments.filter((a) => isOpen(a.status));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/parent" className="text-sm text-muted hover:text-brand-700">
          ← Con của tôi
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{child.full_name}</h1>
            <p className="mt-1 text-muted">
              {child.grade ? `Lớp ${child.grade} · ` : ""}
              {lastActiveLabel(child.last_active)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            <UserMinus className="size-4" aria-hidden /> Gỡ liên kết
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Hôm nay"
          value={`${child.today_problems}/${child.daily_goal}`}
          sub={child.today_problems >= child.daily_goal ? "Đã đạt mục tiêu" : "bài, theo mục tiêu mỗi ngày"}
        />
        <Tile
          label="Chuỗi ngày học"
          value={
            <span className="inline-flex items-center gap-1">
              <Flame className="size-5 text-warning-700" aria-hidden />
              {child.streak_days}
            </span>
          }
          sub="ngày liên tiếp đạt mục tiêu"
        />
        <Tile label="7 ngày qua" value={child.week_problems} sub="bài đã làm" />
        <Tile
          label="Tỉ lệ đúng"
          value={progress.total_attempts ? percent(progress.correct_attempts / progress.total_attempts) : "–"}
          sub={`${progress.total_attempts} bài luyện tập`}
        />
      </div>

      <ActivityChart days={activity} goal={child.daily_goal} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <CardTitle className="mr-auto">Bài lớp giao</CardTitle>
            {open.length > 0 && <Badge>{open.length} bài chưa làm</Badge>}
          </div>
          {!assignments.length ? (
            <p className="mt-3 text-sm text-muted">Con chưa có bài tập lớp nào.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {assignments.slice(0, 8).map((a) => {
                const st = STATUS[a.status ?? "todo"];
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{a.title}</span>
                      <span className="text-xs text-muted">
                        {a.class_name}
                        {a.due_at ? ` · hạn ${formatDateTime(a.due_at)}${isOpen(a.status) ? ` (${dueLabel(a.due_at)})` : ""}` : ""}
                      </span>
                    </span>
                    {a.score != null ? <Badge tone="success">{formatScore(a.score)} điểm</Badge> : <Badge tone={st.tone}>{st.label}</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <CardTitle>Đề đã làm gần đây</CardTitle>
          {!exams.length ? (
            <p className="mt-3 text-sm text-muted">Con chưa làm đề nào.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {exams.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{e.title}</span>
                    <span className="text-xs text-muted">{timeAgo(e.created_at)}</span>
                  </span>
                  {e.score != null ? (
                    <span className="text-sm font-semibold text-ink tabular-nums">{formatScore(e.score)} điểm</span>
                  ) : (
                    <Badge tone="neutral">Chưa nộp</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          {arena.length > 0 && (
            <>
              <CardDescription className="mt-4 font-medium text-ink">Kỷ lục Đấu trường</CardDescription>
              <ul className="mt-1 flex flex-wrap gap-2">
                {arena.map((b) => (
                  <li key={`${b.pool}-${b.duration_minutes}`}>
                    <Badge tone="neutral">
                      {POOL_LABEL[b.pool]} · {b.duration_minutes} phút: <strong className="text-ink">{b.score}</strong>
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <CardTitle>Năng lực theo kỹ năng</CardTitle>
        <CardDescription className="mt-1">Xếp từ yếu đến mạnh. Kỹ năng yếu nhất là chỗ con cần luyện thêm.</CardDescription>
        <div className="mt-5">
          <SkillBars skills={skills} readOnly />
        </div>
      </Card>

      <Dialog
        open={confirming}
        title="Gỡ liên kết?"
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(child.id, {
                  onSuccess: () => router.push("/parent"),
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Gỡ liên kết
            </Button>
          </>
        }
      >
        Bạn sẽ không xem được tiến độ của {child.full_name} nữa. Muốn theo dõi lại thì cần mã liên kết mới.
      </Dialog>
    </div>
  );
}
