import type { Metadata } from "next";
import { SubmissionView } from "@/features/classroom";

export const metadata: Metadata = { title: "Bài làm của học sinh" };

export default async function SubmissionPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const { id, studentId } = await params;
  return <SubmissionView assignmentId={id} studentId={studentId} />;
}
