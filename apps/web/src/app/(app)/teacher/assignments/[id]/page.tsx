import type { Metadata } from "next";
import { ReportView } from "@/features/classroom";

export const metadata: Metadata = { title: "Báo cáo bài tập" };

export default async function AssignmentReportPage({ params }: { params: Promise<{ id: string }> }) {
  return <ReportView id={(await params).id} />;
}
