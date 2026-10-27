import type { Metadata } from "next";
import { SetBuilder } from "@/features/problem-sets";

export const metadata: Metadata = { title: "Soạn bộ đề" };

export default async function ProblemSetPage({ params }: { params: Promise<{ id: string }> }) {
  return <SetBuilder id={(await params).id} />;
}
