import type { Metadata } from "next";
import { ClassView } from "@/features/classroom";

export const metadata: Metadata = { title: "Lớp học" };

export default async function TeacherClassPage({ params }: { params: Promise<{ id: string }> }) {
  return <ClassView id={(await params).id} />;
}
