import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { masteryLevel, percent } from "@/lib/utils";
import type { SkillScore } from "@/types/api";

// Vạch mốc trên thanh: ranh giới giữa các mức thành thạo.
const MARKS = [0.4, 0.6, 0.85];

export function SkillBars({ skills }: { skills: SkillScore[] }) {
  return (
    <ul className="divide-y divide-line">
      {skills.map((s) => {
        const fresh = s.n_attempts === 0;
        const lv = fresh ? ({ label: "Chưa luyện", tone: "neutral" } as const) : masteryLevel(s.score);
        return (
          <li key={s.code} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1 basis-56">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{s.name}</span>
                <Badge tone={lv.tone}>{lv.label}</Badge>
              </div>
              <div
                className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-brand-100"
                role="progressbar"
                aria-label={`${s.name}: ${lv.label}`}
                aria-valuenow={Math.round(s.score * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: fresh ? 0 : percent(s.score) }} />
                {MARKS.map((m) => (
                  <span key={m} className="absolute inset-y-0 w-0.5 bg-white" style={{ left: percent(m) }} aria-hidden />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">{fresh ? "Chưa có lượt làm" : `${percent(s.score)} · ${s.n_attempts} lượt làm`}</p>
            </div>
            <Link href={`/practice?skill=${s.code}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Luyện kỹ năng này
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
