import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ParentLinkCard } from "@/features/family";
import { ProgressOverview } from "@/features/progress";

export const metadata: Metadata = { title: "Tiến độ học tập" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Tiến độ học tập" description="Năng lực theo từng kỹ năng và lịch sử làm bài." />
      <div className="space-y-6">
        <ProgressOverview />
        <ParentLinkCard />
      </div>
    </>
  );
}
