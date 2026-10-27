import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArenaLobby } from "@/features/arena";

export const metadata: Metadata = { title: "Đấu trường" };

export default function ArenaPage() {
  return (
    <div>
      <PageHeader title="Đấu trường" description="Thi đấu làm đề tính giờ: trả lời đúng thật nhiều để leo rank Đồng → Cao thủ và giành chỗ trên bảng xếp hạng." />
      <ArenaLobby />
    </div>
  );
}
