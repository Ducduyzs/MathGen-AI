import type { Metadata } from "next";
import { ChildReportView } from "@/features/family";

export const metadata: Metadata = { title: "Tiến độ của con" };

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  return <ChildReportView id={(await params).id} />;
}
