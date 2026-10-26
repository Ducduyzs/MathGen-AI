"use client";

import { Check, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useProgress } from "../api";

function Ring({ value, done }: { value: number; done: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-10 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" className="stroke-brand-100" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className={cn("transition-[stroke-dashoffset] duration-500", done ? "stroke-success-600" : "stroke-brand-500")}
        />
      </svg>
      {done && <Check className="size-4 text-success-600" aria-hidden />}
    </span>
  );
}

/** Mục tiêu bài/ngày + chuỗi ngày học: mốc nhỏ, dễ đạt để tạo thói quen. */
export function DailyGoal() {
  const { data } = useProgress();
  if (!data) return <Skeleton className="h-14 w-48 rounded-xl" />;

  const done = Math.min(data.today_attempts, data.daily_goal);
  const reached = done >= data.daily_goal;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
      <Ring value={done / data.daily_goal} done={reached} />
      <div className="text-sm leading-tight">
        <p className="font-semibold text-ink">
          {reached ? "Đạt mục tiêu hôm nay!" : `${done}/${data.daily_goal} bài hôm nay`}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-muted">
          <Flame className={cn("size-3.5", data.streak_days > 0 ? "text-warning-700" : "text-muted")} aria-hidden />
          {data.streak_days > 0 ? `Chuỗi ${data.streak_days} ngày` : "Bắt đầu chuỗi ngày học"}
        </p>
      </div>
    </div>
  );
}
