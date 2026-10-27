import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDay } from "../model";

/** Số bài mỗi ngày trong 14 ngày: một chuỗi, một màu; vạch đứt là mục tiêu mỗi ngày, di chuột xem chi tiết. */
export function ActivityChart({ days, goal }: { days: { day: string; count: number }[]; goal: number }) {
  const max = Math.max(goal, ...days.map((d) => d.count), 1);
  const goalAt = (goal / max) * 85;
  const total = days.reduce((s, d) => s + d.count, 0);
  const reached = days.filter((d) => d.count >= goal).length;

  return (
    <Card className="p-5">
      <CardTitle>Hoạt động 14 ngày</CardTitle>
      <p className="text-sm text-muted">
        {total} bài · đạt mục tiêu {reached}/{days.length} ngày
      </p>
      <div
        className="relative mt-4 flex h-40 items-end gap-1 border-b border-line"
        role="img"
        aria-label={`Số bài mỗi ngày: ${days.map((d) => `${formatDay(d.day)}: ${d.count}`).join(", ")}. Mục tiêu ${goal} bài mỗi ngày.`}
      >
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted/50" style={{ bottom: `${goalAt}%` }} aria-hidden>
          <span className="absolute -top-4 left-0 text-[11px] text-muted">Mục tiêu {goal}</span>
        </div>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            <div
              className={cn("w-full max-w-8 rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600")}
              style={{ height: d.count ? `${(d.count / max) * 85}%` : 0 }}
            />
            <span className="pointer-events-none absolute -top-2 z-10 hidden -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block">
              {formatDay(d.day)}: {d.count} bài
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {days.map((d, i) => (
          <span key={d.day} className={cn("flex-1 text-center text-[11px] text-muted tabular-nums", (days.length - 1 - i) % 2 && "max-sm:invisible")}>
            {d.day.slice(8)}
          </span>
        ))}
      </div>
    </Card>
  );
}
