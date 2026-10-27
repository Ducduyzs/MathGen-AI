import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { GamesHub } from "@/features/round-table";

export const metadata: Metadata = { title: "Trò chơi" };

export default function GamesPage() {
  return (
    <div>
      <PageHeader title="Trò chơi" description="Vừa chơi vừa luyện Toán cùng bạn bè. Câu đã làm vẫn được tính XP và chuỗi ngày học." />
      <GamesHub />
    </div>
  );
}
