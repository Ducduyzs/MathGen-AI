import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { SourceJobs } from "@/features/crawler";

export const metadata: Metadata = { title: "Nguồn dữ liệu" };

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <Link href="/admin/sources" className="text-sm text-muted hover:text-brand-700">
        ← Nguồn dữ liệu
      </Link>
      <PageHeader title="Lượt thu thập" />
      <SourceJobs sourceId={id} />
    </div>
  );
}
