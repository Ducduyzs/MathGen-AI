import type { Metadata } from "next";
import { PrintView } from "@/features/problem-sets";

export const metadata: Metadata = { title: "In bộ đề" };

export default async function PrintProblemSetPage({ params }: { params: Promise<{ id: string }> }) {
  return <PrintView id={(await params).id} />;
}
