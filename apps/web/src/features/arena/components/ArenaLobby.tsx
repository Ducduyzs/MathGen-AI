"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Medal, Play, Timer, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/layout/States";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth";
import { errorMessage } from "@/lib/api/errors";
import { cn, timeAgo } from "@/lib/utils";
import type { ArenaDuration, ArenaPool } from "@/types/api";
import { useArenaBoard, useArenaMe, useStartRun } from "../api";
import { ARENA_DURATIONS, defaultPool, POOL_LABEL, POOLS } from "../model";
import { RankBoard, RankCard } from "./Rank";

const MEDAL = ["text-amber-500", "text-slate-400", "text-orange-600"];

function Board({ pool, duration }: { pool: ArenaPool; duration: ArenaDuration }) {
  const [scope, setScope] = useState<"week" | "all">("week");
  const { data, isPending, isError, error, refetch } = useArenaBoard(pool, duration, scope);
  const rows = data ? [...data.rows, ...(data.me ? [data.me] : [])] : [];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <CardTitle className="mr-auto flex items-center gap-2">
          <Medal className="size-4.5 text-brand-500" aria-hidden /> Bảng điểm cao
        </CardTitle>
        <Chip size="sm" selected={scope === "week"} onClick={() => setScope("week")}>
          Tuần này
        </Chip>
        <Chip size="sm" selected={scope === "all"} onClick={() => setScope("all")}>
          Mọi lúc
        </Chip>
        <p className="w-full text-xs text-muted">
          {POOL_LABEL[pool]} · {duration} phút · mỗi người tính lượt điểm cao nhất
        </p>
      </div>
      {isPending ? (
        <Skeleton className="m-4 h-40 rounded-xl" />
      ) : isError ? (
        <div className="p-4">
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        </div>
      ) : !rows.length ? (
        <p className="p-6 text-center text-sm text-muted">Chưa có ai thi{scope === "week" ? " tuần này" : ""}. Hãy là người đầu tiên!</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.user_id} className={cn("flex items-center gap-3 px-4 py-2.5", r.is_me && "bg-brand-50", data?.me === r && "border-t-2 border-dashed border-line")}>
              <span className="grid w-8 shrink-0 place-items-center text-sm font-bold text-muted tabular-nums">
                {r.rank <= 3 ? <Medal className={cn("size-5", MEDAL[r.rank - 1])} aria-label={`Hạng ${r.rank}`} /> : r.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">
                  {r.full_name}
                  {r.is_me && <span className="ml-2 text-xs font-semibold text-brand-700">(Bạn)</span>}
                </span>
                <span className="text-xs text-muted">
                  {r.grade ? `Lớp ${r.grade} · ` : ""}
                  {r.correct}/{r.answered} câu đúng
                </span>
              </span>
              <span className="font-semibold text-ink tabular-nums">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Sảnh Đấu trường: chọn kho câu và thời lượng, kỷ lục của tôi, lượt gần đây, bảng xếp hạng. */
export function ArenaLobby() {
  const router = useRouter();
  const { user } = useAuth();
  const me = useArenaMe();
  const start = useStartRun();
  const [pool, setPool] = useState<ArenaPool>(() => defaultPool(user?.grade));
  const [duration, setDuration] = useState<ArenaDuration>(5);
  const best = me.data?.best.find((b) => b.pool === pool && b.duration_minutes === duration);

  function play() {
    start.mutate({ pool, duration_minutes: duration }, { onSuccess: (r) => router.push(`/arena/${r.id}`), onError: (err) => toast.error(errorMessage(err)) });
  }

  return (
    <div className="space-y-5">
      {me.data ? <RankCard rank={me.data.rank} /> : <Skeleton className="h-28 rounded-2xl" />}
      {me.data?.active_run_id && (
        <Link
          href={`/arena/${me.data.active_run_id}`}
          className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 hover:border-brand-400"
        >
          <Timer className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">
            <strong>Bạn có lượt đấu chưa hết giờ.</strong> Bấm để chơi tiếp.
          </span>
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="p-5 sm:p-6">
          <CardTitle>Chọn kho câu</CardTitle>
          <div role="radiogroup" aria-label="Kho câu" className="mt-3 grid gap-3 sm:grid-cols-3">
            {POOLS.map((p) => (
              <button
                key={p.pool}
                type="button"
                role="radio"
                aria-checked={pool === p.pool}
                onClick={() => setPool(p.pool)}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-colors focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none",
                  pool === p.pool ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-300",
                )}
              >
                <span className="block font-semibold text-ink">{p.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{p.text}</span>
              </button>
            ))}
          </div>

          <CardTitle className="mt-6">Thời gian</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {ARENA_DURATIONS.map((d) => (
              <Chip key={d} selected={duration === d} onClick={() => setDuration(d)}>
                {d} phút
              </Chip>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button size="lg" onClick={play} loading={start.isPending}>
              <Play className="size-4.5" aria-hidden /> Bắt đầu
            </Button>
            <p className="text-sm text-muted">{best ? `Kỷ lục của bạn: ${best.score} điểm` : "Bạn chưa thi ở mục này."}</p>
          </div>
        </Card>

        <Card className="p-5">
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-4.5 text-brand-500" aria-hidden /> Cách tính điểm
          </CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              Mỗi câu đúng: <strong className="text-ink">10 điểm</strong> + điểm độ khó (đến 10).
            </li>
            <li>
              Đúng liên tiếp: thưởng thêm <strong className="text-ink">2 điểm</strong> mỗi câu trong chuỗi, tối đa +10.
            </li>
            <li>Sai hoặc bỏ qua: không trừ điểm nhưng mất chuỗi.</li>
            <li>Câu khó dần theo số câu đã làm. Hết giờ thì lượt tự kết thúc.</li>
          </ul>
          {me.data && me.data.recent.length > 0 && (
            <>
              <CardDescription className="mt-5 font-medium text-ink">Lượt gần đây</CardDescription>
              <ul className="mt-2 space-y-1.5 text-sm">
                {me.data.recent.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link href={`/arena/${r.id}`} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-brand-50">
                      <span className="flex-1 truncate text-muted">
                        {POOL_LABEL[r.pool]} · {r.duration_minutes}′ · {timeAgo(r.finished_at)}
                      </span>
                      <span className="font-semibold text-ink tabular-nums">{r.score}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {me.isPending && <Skeleton className="mt-5 h-20 rounded-xl" />}
        </Card>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <RankBoard />
        <Board pool={pool} duration={duration} />
      </div>
      <p className="text-center text-xs text-muted">
        Muốn luyện kỹ từng dạng?{" "}
        <Link href="/practice" className={buttonClasses({ variant: "ghost", size: "sm", className: "h-auto px-1 py-0" })}>
          Luyện tập theo kỹ năng
        </Link>
      </p>
    </div>
  );
}
