import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableHome } from "@/features/round-table";

export const metadata: Metadata = { title: "Bàn tròn vũ trụ" };

export default function TablePage() {
  return (
    <div>
      <PageHeader title="Bàn tròn vũ trụ" description="Chế độ chơi 4 người: trả lời đúng để trụ lại, sai phải quay vòng hố đen." />
      <TableHome />
    </div>
  );
}
