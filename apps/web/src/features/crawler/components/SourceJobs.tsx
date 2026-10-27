"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileSearch } from "lucide-react";
import { EmptyState } from "@/components/layout/States";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { RegionLabel } from "@/features/regions";
import { cn, timeAgo } from "@/lib/utils";
import { useCrawlJob, useCrawlJobs, useCrawlSources } from "../api";
import { JOB_STATUS, PAGE_STATUS } from "../model";
import { SourceCard } from "./SourceCard";

/** Chi tiết một nguồn: các lượt thu thập và kết quả từng trang của lượt đang chọn. */
export function SourceJobs({ sourceId }: { sourceId: string }) {
  const sources = useCrawlSources();
  const jobs = useCrawlJobs(sourceId);
  const [picked, setPicked] = useState<string | null>(null);
  const jobId = picked ?? jobs.data?.[0]?.id ?? null;
  const job = useCrawlJob(jobId);
  const source = sources.data?.find((s) => s.id === sourceId);

  return (
    <div className="space-y-5">
      {source ? <SourceCard source={source} /> : <Skeleton className="h-40 rounded-2xl" />}

      {jobs.data && jobs.data.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {jobs.data.map((j) => (
            <Chip key={j.id} size="sm" selected={j.id === jobId} onClick={() => setPicked(j.id)}>
              {timeAgo(j.created_at)} · {JOB_STATUS[j.status].label}
            </Chip>
          ))}
        </div>
      )}

      {jobs.data && !jobs.data.length ? (
        <EmptyState icon={FileSearch} title="Chưa thu thập lần nào" description='Bấm "Thu thập" để bắt đầu lượt đầu tiên.' />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <CardTitle className="mr-auto">Kết quả từng trang</CardTitle>
            {job.data && (
              <span className="text-sm text-muted tabular-nums">
                {job.data.pages_fetched} trang · {job.data.questions} câu · {job.data.submitted} vào hàng chờ duyệt
              </span>
            )}
          </div>
          {!job.data ? (
            <Skeleton className="m-4 h-32 rounded-xl" />
          ) : !job.data.pages.length ? (
            <p className="p-6 text-center text-sm text-muted">{job.data.status === "queued" || job.data.status === "running" ? "Đang thu thập…" : "Không có trang nào."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {job.data.pages.map((p) => (
                <li key={p.url} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <Badge tone={PAGE_STATUS[p.status].tone}>{PAGE_STATUS[p.status].label}</Badge>
                  <a href={p.url} target="_blank" rel="noreferrer noopener" className="flex min-w-0 flex-1 items-center gap-1 text-ink hover:text-brand-700">
                    <span className="truncate">{p.title || p.url}</span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted" aria-hidden />
                  </a>
                  {p.error && <span className="text-xs text-danger-700">{p.error}</span>}
                  <RegionLabel region={p.region} className="inline-flex w-full items-center gap-1 pl-1 text-xs text-muted sm:order-last" />
                  {p.questions > 0 && (
                    <span className={cn("text-xs tabular-nums", p.submitted ? "text-success-700" : "text-muted")}>
                      {p.questions} câu · {p.submitted} gửi duyệt
                    </span>
                  )}
                  {p.ingestion_source_id && (
                    <Link href={`/teacher/uploads/${p.ingestion_source_id}`} className="text-xs font-medium text-brand-700 hover:underline">
                      Xem phân tích
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
