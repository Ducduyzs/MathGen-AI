import type { Metadata } from "next";
import { SourceDetail } from "@/features/ingestion";

export const metadata: Metadata = { title: "Kết quả phân tích đề" };

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  return <SourceDetail id={(await params).id} />;
}
