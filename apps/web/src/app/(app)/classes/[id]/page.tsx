import type { Metadata } from "next";
import { ClassView } from "@/features/classroom";

export const metadata: Metadata = { title: "Lớp học" };

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  return <ClassView id={(await params).id} />;
}
