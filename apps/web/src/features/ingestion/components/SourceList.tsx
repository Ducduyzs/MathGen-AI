"use client";

import Link from "next/link";
import { ChevronRight, ClipboardPaste, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils";
import type { IngestionSourceSummary } from "@/types/api";
import { useSources } from "../api";

export function StatusBadge({ status }: { status: IngestionSourceSummary["status"] }) {
  if (status === "processing") return <Badge tone="warning">Đang xử lý</Badge>;
  if (status === "failed") return <Badge tone="danger">Lỗi</Badge>;
  return <Badge tone="success">Xong</Badge>;
}

export function SourceList() {
  const { data, isPending } = useSources();

  if (isPending) return <Skeleton className="h-40 rounded-2xl" />;
  if (!data?.length) return null;

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>Tài liệu gần đây</CardTitle>
      <ul className="mt-3 divide-y divide-line">
        {data.map((s) => {
          const Icon = s.origin === "file" ? FileText : ClipboardPaste;
          return (
            <li key={s.id}>
              <Link href={`/teacher/uploads/${s.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-brand-50">
                <Icon className="size-5 shrink-0 text-brand-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-muted">
                    {timeAgo(s.created_at)}
                    {s.status === "done" && ` · ${s.stats.total} câu · nhận dạng ${s.stats.recognized}`}
                  </p>
                </div>
                <StatusBadge status={s.status} />
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
