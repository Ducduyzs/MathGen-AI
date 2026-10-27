"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Crown, Gem, Shield, ShieldCheck, Trophy } from "lucide-react";
import { ErrorState } from "@/components/layout/States";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { ArenaRank, ArenaRankChange, RankTier } from "@/types/api";
import { useRankBoard } from "../api";

const TIER: Record<RankTier, { icon: LucideIcon; ring: string; bg: string; text: string }> = {
  bronze: { icon: Shield, ring: "ring-orange-300", bg: "bg-gradient-to-br from-orange-300 to-orange-700", text: "text-orange-800" },
  silver: { icon: Shield, ring: "ring-slate-300", bg: "bg-gradient-to-br from-slate-200 to-slate-500", text: "text-slate-600" },
  gold: { icon: ShieldCheck, ring: "ring-amber-300", bg: "bg-gradient-to-br from-yellow-200 to-amber-500", text: "text-amber-700" },
  platinum: { icon: ShieldCheck, ring: "ring-teal-300", bg: "bg-gradient-to-br from-teal-200 to-cyan-600", text: "text-teal-700" },
  diamond: { icon: Gem, ring: "ring-sky-300", bg: "bg-gradient-to-br from-sky-300 to-indigo-600", text: "text-indigo-700" },
  master: { icon: Crown, ring: "ring-fuchsia-300", bg: "bg-gradient-to-br from-fuchsia-400 to-violet-700", text: "text-violet-700" },
};

/** Huy hiệu bậc rank: khiên Đồng/Bạc, khiên có dấu Vàng/Bạch kim, kim cương, vương miện Cao thủ. */
export function RankEmblem({ rank, size = "md" }: { rank: ArenaRank; size?: "sm" | "md" | "lg" }) {
  const t = TIER[rank.tier];
  const Icon = t.icon;
  const box = { sm: "size-7", md: "size-12", lg: "size-16" }[size];
  const icon = { sm: "size-4", md: "size-6", lg: "size-8" }[size];
  return (
    <span className={cn("relative grid shrink-0 place-items-center rounded-2xl text-white shadow-sm ring-2", box, t.bg, t.ring)} title={rank.label}>
      <Icon className={icon} aria-hidden />
      {rank.division && size !== "sm" && (
        <span className="absolute -right-1.5 -bottom-1.5 rounded-md bg-white px-1 text-[10px] leading-4 font-bold text-ink ring-1 ring-line">{rank.division}</span>
      )}
    </span>
  );
}

/** Thẻ rank ở sảnh Đấu trường: bậc hiện tại và thanh tiến độ lên hạng kế tiếp. */
export function RankCard({ rank }: { rank: ArenaRank }) {
  const t = TIER[rank.tier];
  const progress = rank.next_at ? (rank.points - rank.floor) / (rank.next_at - rank.floor) : 1;
  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <RankEmblem rank={rank} size="lg" />
      <div className="min-w-48 flex-1">
        <p className="text-sm text-muted">Rank của bạn</p>
        <p className={cn("text-xl font-bold", t.text)}>{rank.label}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50" role="progressbar" aria-valuemin={rank.floor} aria-valuemax={rank.next_at ?? rank.points} aria-valuenow={rank.points} aria-label="Tiến độ lên hạng">
          <div className={cn("h-full rounded-full", t.bg)} style={{ width: `${Math.max(3, progress * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted tabular-nums">
          {rank.points} điểm rank
          {rank.next_at ? ` · còn ${rank.next_at - rank.points} điểm để lên hạng` : " · bậc cao nhất"}
          {rank.ranked_runs === 0 && " · chơi một lượt từ 3 câu trở lên để nhận rank"}
        </p>
      </div>
      <p className="w-full text-xs text-muted sm:w-64">
        Mỗi lượt từ 3 câu: điểm/phút cao hơn mức chuẩn của bậc thì lên điểm, thấp hơn thì bị trừ. Lượt 15–30 phút tính nặng hơn.
      </p>
    </Card>
  );
}

/** Dòng thay đổi rank ở màn kết quả. */
export function RankChangeBadge({ change }: { change: ArenaRankChange }) {
  const up = change.delta >= 0;
  const moved = change.before.label !== change.after.label;
  const promoted = moved && change.after.points > change.before.points;
  return (
    <div className="mx-auto mt-5 flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left">
      <RankEmblem rank={change.after} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">
          {promoted ? `Lên hạng ${change.after.label}!` : moved ? `Xuống ${change.after.label}` : change.after.label}
        </p>
        <p className="text-sm text-muted tabular-nums">{change.after.points} điểm rank</p>
      </div>
      {change.delta === 0 ? (
        <span className="text-lg font-bold text-muted tabular-nums">±0</span>
      ) : (
        <span className={cn("flex items-center gap-0.5 text-lg font-bold tabular-nums", up ? "text-success-700" : "text-danger-700")}>
          {up ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
          {up ? "+" : ""}
          {change.delta}
        </span>
      )}
    </div>
  );
}

/** Bảng xếp hạng rank (chung mọi kho câu và thời lượng). */
export function RankBoard() {
  const { data, isPending, isError, error, refetch } = useRankBoard();
  const rows = data ? [...data.rows, ...(data.me ? [data.me] : [])] : [];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line p-4">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4.5 text-amber-500" aria-hidden /> Bảng xếp hạng rank
        </CardTitle>
      </div>
      <div className="p-4">
        {isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : !rows.length ? (
          <p className="py-6 text-center text-sm text-muted">Chưa ai có rank. Hãy là người đầu tiên!</p>
        ) : (
          <ol className="space-y-1.5">
            {rows.map((r, i) => (
              <li
                key={r.user_id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  r.is_me ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-surface",
                  data?.me && i === rows.length - 1 && "mt-3 border-t border-dashed border-line pt-3",
                )}
              >
                <span className="w-7 text-center font-bold text-muted tabular-nums">{r.rank}</span>
                <RankEmblem rank={r.rating} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">
                  {r.full_name}
                  {r.is_me && " (bạn)"}
                  {r.grade ? <span className="font-normal text-muted"> · Lớp {r.grade}</span> : null}
                </span>
                <span className={cn("hidden text-xs font-semibold sm:block", TIER[r.rating.tier].text)}>{r.rating.label}</span>
                <span className="w-14 text-right font-semibold text-ink tabular-nums">{r.rating.points}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
