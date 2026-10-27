import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeacherClasses } from "@/features/classroom";

export const metadata: Metadata = { title: "Lớp học" };

export default function TeacherClassesPage() {
  return (
    <div>
      <PageHeader title="Lớp học" description="Tạo lớp, giao bài có hạn nộp và xem báo cáo kết quả của cả lớp." />
      <TeacherClasses />
    </div>
  );
}
