import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SourceList, UploadForm, UploadIntro } from "@/features/ingestion";

export const metadata: Metadata = { title: "Tải tài liệu" };

export default function UploadsPage() {
  return (
    <div>
      <PageHeader title="Tải tài liệu" description="Tải đề lên để hệ thống tách câu, nhận dạng, giải và sinh biến thể có kiểm chứng." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <UploadForm />
        <div className="space-y-5">
          <UploadIntro />
          <SourceList />
        </div>
      </div>
    </div>
  );
}
