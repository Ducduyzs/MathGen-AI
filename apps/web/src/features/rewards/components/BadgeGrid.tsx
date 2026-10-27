import { Lock } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BadgeInfo } from "@/types/api";
import { badgeIcon } from "../model";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export function BadgeGrid({ badges }: { badges: BadgeInfo[] }) {
  const earned = badges.filter((b) => b.earned_at).length;
  return (
    <Card className="p-5">
      <CardTitle>Huy hiệu</CardTitle>
      <p className="text-sm text-muted">
        Đã nhận {earned}/{badges.length}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {badges.map((b) => {
          const Icon = badgeIcon(b.code);
          const got = !!b.earned_at;
          return (
            <li
              key={b.code}
              className={cn("flex flex-col items-center rounded-xl border p-3 text-center", got ? "border-brand-200 bg-brand-50/60" : "border-line")}
            >
              <span
                className={cn(
                  "relative grid size-12 place-items-center rounded-full",
                  got ? "bg-brand-600 text-white" : "bg-surface text-muted/60 ring-1 ring-line ring-inset",
                )}
              >
                <Icon className="size-6" aria-hidden />
                {!got && (
                  <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-white text-muted ring-1 ring-line">
                    <Lock className="size-3" aria-hidden />
                  </span>
                )}
              </span>
              <p className={cn("mt-2 text-sm font-semibold", got ? "text-ink" : "text-muted")}>{b.title}</p>
              <p className="mt-0.5 text-xs text-muted">{b.description}</p>
              {got && <p className="mt-1 text-[11px] font-medium text-brand-700">{date.format(new Date(b.earned_at!))}</p>}
              <span className="sr-only">{got ? "Đã nhận" : "Chưa nhận"}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
