import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Lightbulb, Lock } from "lucide-react";
import { MathText } from "@/components/math";
import { ProblemMeta } from "@/components/problem/ProblemMeta";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProblem } from "@/features/problems";
import { plainText } from "@/lib/utils";

// ISR: render lần đầu khi có request, cache 1 giờ (Cloudflare cache thêm phía trước).
export const revalidate = 3600;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const problem = await getProblem((await params).id);
  if (!problem) return { title: "Không tìm thấy bài" };
  const text = plainText(problem.statement);
  return {
    title: `${text.length > 70 ? `${text.slice(0, 67)}…` : text} (Lớp ${problem.grade})`,
    description: `Bài tập ${problem.skill.name} lớp ${problem.grade}: ${text}`,
  };
}

export default async function ProblemPage({ params }: Props) {
  const problem = await getProblem((await params).id);
  if (!problem) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/problems" className="hover:text-brand-700">
          Ngân hàng bài
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <Link href={`/problems?grade=${problem.grade}`} className="hover:text-brand-700">
          Lớp {problem.grade}
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <Link href={`/problems?skill=${problem.skill.code}`} className="hover:text-brand-700">
          {problem.skill.name}
        </Link>
      </nav>

      <Card className="mt-4 p-6 sm:p-8">
        <ProblemMeta grade={problem.grade} skill={problem.skill} difficulty={problem.difficulty} />
        <h1 className="mt-4 text-xl leading-relaxed font-medium text-ink sm:text-2xl">
          <MathText text={problem.statement} />
        </h1>

        {problem.choices && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {problem.choices.map((c) => (
              <li key={c.key} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {c.key}
                </span>
                <MathText text={c.content} />
              </li>
            ))}
          </ul>
        )}

        {problem.hints?.map((hint, i) => (
          <details key={i} className="mt-3 rounded-xl bg-warning-50 px-4 py-3 text-warning-700 first-of-type:mt-6">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
              <Lightbulb className="size-4" aria-hidden /> Gợi ý {i + 1}
            </summary>
            <MathText text={hint} className="mt-2 block text-sm text-ink" />
          </details>
        ))}
      </Card>

      <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:flex-row sm:items-center">
        <Lock className="size-6 shrink-0 text-brand-500" aria-hidden />
        <p className="flex-1 text-brand-900">Làm bài để xem lời giải chi tiết và cập nhật hồ sơ năng lực của bạn.</p>
        <Link href={`/practice?skill=${problem.skill.code}`} className={buttonClasses()}>
          Luyện dạng này
        </Link>
      </div>
    </div>
  );
}
