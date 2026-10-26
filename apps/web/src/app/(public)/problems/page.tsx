import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/layout/States";
import { getProblems, getSkills, ProblemCard, ProblemFilters, type ProblemQuery } from "@/features/problems";

export const metadata: Metadata = {
  title: "Ngân hàng bài Toán",
  description: "Bài tập Đại số lớp 6–12 đã được kiểm chứng, lọc theo lớp, chủ đề và độ khó.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProblemsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const one = (key: string) => (typeof sp[key] === "string" && sp[key] ? (sp[key] as string) : undefined);
  const query: ProblemQuery = { grade: one("grade"), skill: one("skill"), level: one("level"), q: one("q") };

  const [data, skills] = await Promise.all([getProblems(query), getSkills()]);
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Ngân hàng bài</h1>
      <p className="mt-2 text-muted">Bài tập Đại số lớp 6–12, mỗi bài đều đã được bộ giải toán kiểm chứng.</p>

      <div className="mt-6">
        <ProblemFilters skills={skills ?? []} value={query} />
      </div>

      <p className="mt-6 text-sm text-muted">{data?.total ?? 0} bài</p>
      {items.length ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProblemCard key={p.id} problem={p} />
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState icon={SearchX} title="Không có bài phù hợp" description="Thử bỏ bớt bộ lọc hoặc đổi từ khóa." />
        </div>
      )}
    </div>
  );
}
