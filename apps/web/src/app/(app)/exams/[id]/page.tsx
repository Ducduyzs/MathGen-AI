import type { Metadata } from "next";
import { ExamRunner } from "@/features/exams";

export const metadata: Metadata = { title: "Làm bài" };

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  return <ExamRunner id={(await params).id} />;
}
