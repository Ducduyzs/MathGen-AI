"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CircleCheck, CircleX, Globe, Pause, Play, Search, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/errors";
import { timeAgo } from "@/lib/utils";
import type { CrawlSource, RobotsCheck } from "@/types/api";
import { useCancelCrawl, useDeleteCrawlSource, useRobotsCheck, useStartCrawl, useUpdateCrawlSource } from "../api";
import { isBusy, JOB_STATUS } from "../model";

export function SourceCard({ source: s }: { source: CrawlSource }) {
  const start = useStartCrawl();
  const cancel = useCancelCrawl();
  const update = useUpdateCrawlSource();
  const remove = useDeleteCrawlSource();
  const robots = useRobotsCheck();
  const [checks, setChecks] = useState<RobotsCheck[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const job = s.last_job;
  const busy = isBusy(job?.status);
  const onError = (err: unknown) => toast.error(errorMessage(err));

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Globe className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{s.name}</p>
          <p className="truncate text-sm text-muted">
            {s.domain}
            {s.include_paths.length ? ` · ${s.include_paths.join(", ")}` : ""} · lớp {s.grade_min}–{s.grade_max}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="success">{s.license_label}</Badge>
            <Badge tone={s.status === "active" ? "brand" : "warning"}>{s.status === "active" ? "Đang bật" : "Tạm dừng"}</Badge>
            {job && <Badge tone={JOB_STATUS[job.status].tone}>{JOB_STATUS[job.status].label}</Badge>}
          </div>
        </div>
        <Link href={`/admin/sources/${s.id}`} className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          Chi tiết <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {job && (
        <p className="mt-3 text-sm text-muted tabular-nums">
          Lượt gần nhất {timeAgo(job.created_at)}: {job.pages_fetched} trang · {job.documents} tài liệu có câu hỏi · {job.questions} câu ·{" "}
          <strong className="text-ink">{job.submitted} câu vào hàng chờ duyệt</strong>
          {job.error && <span className="text-danger-700"> · {job.error}</span>}
        </p>
      )}

      {checks && (
        <ul className="mt-3 space-y-1 rounded-xl bg-surface p-3 text-sm">
          {checks.map((c) => (
            <li key={c.url} className="flex items-center gap-2">
              {c.allowed ? <CircleCheck className="size-4 shrink-0 text-success-600" aria-hidden /> : <CircleX className="size-4 shrink-0 text-danger-600" aria-hidden />}
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{c.url}</span>
              <span className={c.allowed ? "text-success-700" : "text-danger-700"}>
                {c.allowed ? `robots.txt cho phép${c.crawl_delay ? ` · giãn cách ${c.crawl_delay}s` : ""}` : c.reason}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {busy ? (
          <Button size="sm" variant="dangerOutline" loading={cancel.isPending} onClick={() => cancel.mutate(job!.id, { onError })}>
            <Square className="size-4" aria-hidden /> Dừng thu thập
          </Button>
        ) : (
          <Button size="sm" disabled={s.status !== "active"} loading={start.isPending} onClick={() => start.mutate(s.id, { onSuccess: () => toast.success("Đã bắt đầu thu thập"), onError })}>
            <Play className="size-4" aria-hidden /> Thu thập
          </Button>
        )}
        <Button size="sm" variant="outline" loading={robots.isPending} onClick={() => robots.mutate(s.id, { onSuccess: setChecks, onError })}>
          <Search className="size-4" aria-hidden /> Kiểm tra robots.txt
        </Button>
        <Button size="sm" variant="ghost" loading={update.isPending} onClick={() => update.mutate({ id: s.id, status: s.status === "active" ? "paused" : "active" }, { onError })}>
          {s.status === "active" ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {s.status === "active" ? "Tạm dừng nguồn" : "Bật lại"}
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-danger-700" onClick={() => setDeleting(true)}>
          <Trash2 className="size-4" aria-hidden /> Xóa
        </Button>
      </div>

      <Dialog
        open={deleting}
        title={`Xóa nguồn ${s.domain}?`}
        onClose={() => setDeleting(false)}
        actions={
          <>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(s.id, { onSuccess: () => setDeleting(false), onError })}>
              Xóa nguồn
            </Button>
          </>
        }
      >
        Lịch sử thu thập của nguồn sẽ bị xóa. Bài đã vào hàng chờ duyệt hoặc ngân hàng vẫn giữ nguyên (kèm đường dẫn gốc).
      </Dialog>
    </Card>
  );
}
