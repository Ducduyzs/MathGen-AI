import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExamHub, RecentExams } from "@/features/exams";

export const metadata: Metadata = { title: "Làm đề" };

export default function ExamsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Làm đề" description="Ôn tập theo ý muốn, hoặc làm đề thi đúng cấu trúc của Bộ GD&ĐT." />
      <ExamHub />
      <RecentExams />
    </div>
  );
}
