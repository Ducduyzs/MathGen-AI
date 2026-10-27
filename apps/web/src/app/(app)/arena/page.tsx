import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArenaLobby } from "@/features/arena";
import { TablePromo } from "@/features/round-table";

export const metadata: Metadata = { title: "Đấu trường" };

export default function ArenaPage() {
  return (
    <div>
      <PageHeader title="Đấu trường" description="Trả lời càng nhiều câu đúng càng tốt trước khi hết giờ, giành chỗ trên bảng xếp hạng tuần." />
      <TablePromo />
      <ArenaLobby />
    </div>
  );
}
