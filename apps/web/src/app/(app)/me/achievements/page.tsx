import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { AchievementsView } from "@/features/rewards";

export const metadata: Metadata = { title: "Thành tích" };

export default function AchievementsPage() {
  return (
    <>
      <PageHeader title="Thành tích" description="Chuỗi ngày học, XP, nhiệm vụ hằng ngày và huy hiệu." />
      <AchievementsView />
    </>
  );
}
