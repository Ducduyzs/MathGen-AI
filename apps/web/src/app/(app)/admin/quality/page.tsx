import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { QualityDashboard } from "@/features/admin";

export const metadata: Metadata = { title: "Chất lượng" };

export default function QualityPage() {
  return (
    <div>
      <PageHeader title="Chất lượng nội dung" description="Độ phủ ngân hàng bài, kết quả duyệt, bài nghi sai đáp án và hiệu quả pipeline, bộ gom." />
      <QualityDashboard />
    </div>
  );
}
