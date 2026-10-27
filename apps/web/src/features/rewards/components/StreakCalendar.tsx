import { Flame, Snowflake } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/types/api";
import { shortDay, weekdayMon } from "../model";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const STATUS_LABEL: Record<CalendarDay["status"], string> = {
  met: "đạt mục tiêu",
  frozen: "đóng băng",
  partial: "chưa đạt mục tiêu",
  none: "không học",
};

/** 5 tuần gần nhất, mỗi ô một ngày: đạt mục tiêu, được đóng băng, có học nhưng chưa đạt, hoặc nghỉ. */
export function StreakCalendar({ days, goal, today }: { days: CalendarDay[]; goal: number; today: string }) {
  const lead = days.length ? weekdayMon(days[0].day) : 0;
  return (
    <Card className="p-5">
      <CardTitle>Lịch học 5 tuần</CardTitle>
      <p className="text-sm text-muted">Mỗi ngày làm đủ {goal} câu để giữ chuỗi</p>
      <div className="mt-4 grid max-w-80 grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1 text-[11px] font-medium text-muted">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`pad${i}`} aria-hidden />
        ))}
        {days.map((d) => (
          <span
            key={d.day}
            title={`${shortDay(d.day)}: ${d.count} câu · ${STATUS_LABEL[d.status]}`}
            aria-label={`${shortDay(d.day)}: ${d.count} câu, ${STATUS_LABEL[d.status]}`}
            className={cn(
              "relative grid aspect-square place-items-center rounded-lg text-xs tabular-nums",
              d.status === "met" && "bg-brand-500 font-semibold text-white",
              d.status === "frozen" && "bg-brand-100 text-brand-700",
              d.status === "partial" && "bg-brand-50 text-brand-700 ring-1 ring-brand-200 ring-inset",
              d.status === "none" && "text-muted",
              d.day === today && "ring-2 ring-ink ring-offset-1",
            )}
          >
            {d.status === "frozen" ? <Snowflake className="size-4" aria-hidden /> : Number(d.day.slice(8))}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-brand-500" aria-hidden /> Đạt mục tiêu
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-brand-50 ring-1 ring-brand-200 ring-inset" aria-hidden /> Có học, chưa đủ
        </span>
        <span className="flex items-center gap-1.5">
          <Snowflake className="size-3 text-brand-700" aria-hidden /> Đóng băng
        </span>
        <span className="flex items-center gap-1.5">
          <Flame className="size-3 text-warning-700" aria-hidden /> Chuỗi tính các ngày liền nhau
        </span>
      </div>
    </Card>
  );
}
