"use client";

import { useState } from "react";
import { Globe, Plus, ShieldCheck } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { useCrawlSources } from "../api";
import { SourceCard } from "./SourceCard";
import { SourceForm } from "./SourceForm";

const RULES = [
  "Chỉ thu thập nguồn đã khai báo giấy phép: đề thi của cơ quan nhà nước, CC0 / CC BY / CC BY-SA, phạm vi công cộng hoặc có văn bản cho phép.",
  "Luôn đọc và tuân thủ robots.txt, Crawl-delay và thẻ noindex; tự xưng danh MathGenBot; mặc định cách 3 giây giữa hai lượt tải.",
  "Chỉ đi trong tên miền và thư mục đã khai báo; không truy cập địa chỉ nội bộ.",
  "Câu nhận dạng và kiểm chứng đủ mới vào hàng chờ duyệt, kèm URL gốc và giấy phép; giáo viên duyệt rồi mới vào ngân hàng.",
];

export function CrawlerHome() {
  const { data, isPending, isError, error, refetch } = useCrawlSources();
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      <Card className="flex gap-3 border-success-200 bg-success-50/50 p-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-700" aria-hidden />
        <ul className="list-disc space-y-1 pl-4 text-sm text-ink marker:text-success-600">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>

      {adding ? (
        <SourceForm onDone={() => setAdding(false)} />
      ) : (
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Thêm nguồn
        </Button>
      )}

      {isPending ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !data.length ? (
        <EmptyState icon={Globe} title="Chưa có nguồn nào" description="Thêm một nguồn được phép (ví dụ trang đề thi chính thức của Bộ, Sở GD&ĐT) để bắt đầu thu thập." />
      ) : (
        <div className="space-y-4">
          {data.map((s) => (
            <SourceCard key={s.id} source={s} />
          ))}
        </div>
      )}
    </div>
  );
}
