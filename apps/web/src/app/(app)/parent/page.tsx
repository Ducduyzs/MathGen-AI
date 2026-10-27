import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ParentHome } from "@/features/family";

export const metadata: Metadata = { title: "Con của tôi" };

export default function ParentPage() {
  return (
    <div>
      <PageHeader title="Con của tôi" description="Theo dõi con học mỗi ngày: số bài, chuỗi ngày học, bài lớp giao và kỹ năng cần luyện thêm." />
      <ParentHome />
    </div>
  );
}
