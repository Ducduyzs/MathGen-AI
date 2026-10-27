import { Check, ListChecks, Target } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Quest } from "@/types/api";

export function QuestsCard({ quests }: { quests: Quest[] }) {
  const done = quests.filter((q) => q.done).length;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4.5 text-brand-600" aria-hidden /> Nhiệm vụ hôm nay
          </CardTitle>
          <p className="text-sm text-muted">Làm mới lúc 0:00 mỗi ngày</p>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-semibold text-brand-700 tabular-nums">
          {done}/{quests.length}
        </span>
      </div>
      <ul className="mt-4 space-y-4">
        {quests.map((q) => (
          <li key={q.code} className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full",
                q.done ? "bg-success-600 text-white" : "bg-surface text-muted ring-1 ring-line ring-inset",
              )}
            >
              {q.done ? <Check className="size-4.5" aria-hidden /> : <Target className="size-4.5" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className={cn("font-medium", q.done ? "text-muted line-through" : "text-ink")}>{q.title}</span>
                <span className="shrink-0 text-muted tabular-nums">
                  {q.progress}/{q.target}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-100"
                role="progressbar"
                aria-label={q.title}
                aria-valuemin={0}
                aria-valuemax={q.target}
                aria-valuenow={q.progress}
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", q.done ? "bg-success-600" : "bg-brand-500")}
                  style={{ width: `${(q.progress / q.target) * 100}%` }}
                />
              </div>
            </div>
            <span className="w-14 shrink-0 text-right text-xs font-semibold text-brand-700">+{q.reward} XP</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
