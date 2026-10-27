import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { StudentClasses } from "@/features/classroom";

export const metadata: Metadata = { title: "Lớp học" };

export default function ClassesPage() {
  return (
    <div>
      <PageHeader title="Lớp học" description="Bài tập giáo viên giao, hạn nộp và bảng xếp hạng của lớp." />
      <StudentClasses />
    </div>
  );
}
