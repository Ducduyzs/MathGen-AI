import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { CrawlerHome } from "@/features/crawler";

export const metadata: Metadata = { title: "Nguồn dữ liệu" };

export default function SourcesPage() {
  return (
    <div>
      <PageHeader title="Nguồn dữ liệu" description="Bộ gom đề Toán lớp 1–12 từ các nguồn công khai được phép, đưa vào hàng chờ duyệt kèm nguồn gốc." />
      <CrawlerHome />
    </div>
  );
}
