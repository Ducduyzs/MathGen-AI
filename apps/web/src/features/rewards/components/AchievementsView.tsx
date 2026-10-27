"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Flame, Snowflake, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useRewards } from "../api";
import { formatXp } from "../model";
import { BadgeGrid } from "./BadgeGrid";
import { QuestsCard } from "./QuestsCard";
import { StreakCalendar } from "./StreakCalendar";

function Stat({ icon: Icon, tone, label, value, hint }: { icon: LucideIcon; tone: string; label: string; value: ReactNode; hint: ReactNode }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-xl font-bold text-ink tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
      </div>
    </Card>
  );
}

export function AchievementsView() {
  const { data, error } = useRewards();
  if (error) return <p className="rounded-xl bg-danger-50 p-4 text-sm text-danger-700">{errorMessage(error)}</p>;
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={Flame}
          tone={data.streak_days > 0 ? "bg-warning-50 text-warning-700" : "bg-surface text-muted"}
          label="Chuỗi ngày học"
          value={`${data.streak_days} ngày`}
          hint={`Dài nhất: ${data.longest_streak} ngày`}
        />
        <Stat
          icon={Zap}
          tone="bg-brand-50 text-brand-700"
          label="Tổng XP"
          value={formatXp(data.xp_total)}
          hint={`Hôm nay +${data.xp_today} XP`}
        />
        <Stat
          icon={Snowflake}
          tone="bg-brand-50 text-brand-500"
          label="Đóng băng chuỗi"
          value={`${data.freezes}/${data.max_freezes} lượt`}
          hint={`Tự giữ chuỗi khi bạn nghỉ. Giữ chuỗi ${data.freeze_every} ngày được thêm 1 lượt.`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <QuestsCard quests={data.quests} />
        <StreakCalendar days={data.calendar} goal={data.daily_goal} today={data.today} />
      </div>

      <BadgeGrid badges={data.badges} />

      <p className="text-xs text-muted">
        Cách tính XP: đúng 10 XP (dùng gợi ý 5 XP), sai vẫn được 2 XP · đạt mục tiêu ngày +20 XP · mỗi nhiệm vụ +10 đến +30 XP.
      </p>
    </div>
  );
}
