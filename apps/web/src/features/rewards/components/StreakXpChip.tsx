"use client";

import Link from "next/link";
import { Flame, Snowflake, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRewards } from "../api";
import { formatXp } from "../model";

/** Chuỗi ngày · XP · lượt đóng băng, luôn hiện trên thanh điều hướng của học sinh. */
export function StreakXpChip({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { data } = useRewards();
  if (!data) return null;
  const xp = formatXp(data.xp_total).replace(" XP", "");
  return (
    <Link
      href="/me/achievements"
      onClick={onNavigate}
      title="Xem thành tích"
      aria-label={`Chuỗi ${data.streak_days} ngày, ${formatXp(data.xp_total)}, ${data.freezes} lượt đóng băng. Xem thành tích`}
      className={cn("flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums hover:bg-brand-50", className)}
    >
      <span className={cn("flex items-center gap-1", data.streak_days > 0 ? "text-warning-700" : "text-muted")}>
        <Flame className="size-4" aria-hidden />
        {data.streak_days}
      </span>
      <span className="flex items-center gap-1 text-brand-700">
        <Zap className="size-4" aria-hidden />
        {xp}
      </span>
      <span className={cn("flex items-center gap-1", data.freezes > 0 ? "text-brand-500" : "text-muted/60")}>
        <Snowflake className="size-4" aria-hidden />
        {data.freezes}
      </span>
    </Link>
  );
}
