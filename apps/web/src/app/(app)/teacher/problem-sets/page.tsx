import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProblemSetList } from "@/features/problem-sets";

export const metadata: Metadata = { title: "Bộ đề" };

export default function ProblemSetsPage() {
  return (
    <div>
      <PageHeader title="Bộ đề" description="Soạn đề theo ý bạn từ các dạng bài, dùng lại để giao cho nhiều lớp hoặc in ra giấy." />
      <ProblemSetList />
    </div>
  );
}
