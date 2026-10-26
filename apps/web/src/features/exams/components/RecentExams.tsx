"use client";

import Link from "next/link";
import { ChevronRight, GraduationCap, ListChecks, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils";
import { useRecentExams } from "../api";
import { formatScore } from "../model";

export function RecentExams() {
  const { data, isPending } = useRecentExams();

  if (isPending) return <Skeleton className="h-40 rounded-2xl" />;
  if (!data?.length) return null;

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>Đề gần đây</CardTitle>
      <ul className="mt-3 divide-y divide-line">
        {data.map((e) => {
          const Icon = e.kind === "official" ? GraduationCap : e.mode === "choice" ? ListChecks : PenLine;
          return (
            <li key={e.id}>
              <Link href={`/exams/${e.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-brand-50">
                <Icon className="size-5 shrink-0 text-brand-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{e.title}</p>
                  <p className="text-xs text-muted">
                    {e.kind === "official" ? "Đề thi" : "Ôn tập"} · {timeAgo(e.created_at)}
                  </p>
                </div>
                {e.score === null ? (
                  <Badge tone="warning">Chưa nộp</Badge>
                ) : (
                  <Badge tone={e.score >= 8 ? "success" : e.score >= 5 ? "brand" : "danger"}>
                    {formatScore(e.score)} điểm · {e.correct}/{e.size}
                  </Badge>
                )}
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
