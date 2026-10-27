"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, FileSearch } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import type { ExtractedItem } from "@/types/api";
import { useSource } from "../api";
import { ItemCard } from "./ItemCard";
import { StatusBadge } from "./SourceList";
import { StepProgress } from "./StepProgress";

type Filter = "all" | "recognized" | "unrecognized" | "duplicate";

const FILTERS: { value: Filter; label: string; test: (i: ExtractedItem) => boolean }[] = [
  { value: "all", label: "Tất cả", test: () => true },
  { value: "recognized", label: "Nhận dạng được", test: (i) => i.status === "recognized" },
  { value: "unrecognized", label: "Chưa hỗ trợ", test: (i) => i.status !== "recognized" },
  { value: "duplicate", label: "Trùng", test: (i) => !!i.duplicate_of },
];

export function SourceDetail({ id }: { id: string }) {
  const source = useSource(id);
  const [filter, setFilter] = useState<Filter>("all");

  const back = (
    <Link href="/teacher/uploads" className={buttonClasses({ variant: "ghost", size: "sm" })}>
      <ArrowLeft className="size-4" aria-hidden /> Tải đề khác
    </Link>
  );

  if (source.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (source.isError) return <ErrorState message={errorMessage(source.error)} onRetry={() => source.refetch()} />;

  const src = source.data;
  const items = src.items.filter(FILTERS.find((f) => f.value === filter)!.test);

  return (
    <div className="space-y-5">
      <PageHeader title={src.name} description={src.origin === "file" ? "Tài liệu tải lên" : "Nội dung dán vào"} actions={back} />

      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-ink">Tiến trình</p>
          <StatusBadge status={src.status} />
        </div>
        <StepProgress steps={src.steps} />
        {src.status === "failed" && (
          <p className="flex items-start gap-2 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {src.error ?? "Không xử lý được tài liệu."}
          </p>
        )}
        {src.status === "done" && (
          <dl className="grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
            {[
              ["Câu tách được", src.stats.total, "text-ink"],
              ["Nhận dạng được", src.stats.recognized, "text-brand-700"],
              ["Trùng", src.stats.duplicates, src.stats.duplicates ? "text-warning-700" : "text-ink"],
            ].map(([label, value, color]) => (
              <div key={label as string}>
                <dd className={`text-2xl font-bold ${color}`}>{value}</dd>
                <dt className="text-xs text-muted sm:text-sm">{label}</dt>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {src.status === "done" && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc câu">
            {FILTERS.map((f) => (
              <Chip key={f.value} size="sm" selected={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label} ({src.items.filter(f.test).length})
              </Chip>
            ))}
          </div>
          {items.length ? (
            <div className="space-y-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState icon={FileSearch} title="Không có câu nào trong mục này" />
          )}
        </>
      )}
    </div>
  );
}
