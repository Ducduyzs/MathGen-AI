import Link from "next/link";
import { MathText } from "@/components/math";
import { ProblemMeta } from "@/components/problem/ProblemMeta";
import type { PublicProblem } from "@/types/api";

export function ProblemCard({ problem }: { problem: PublicProblem }) {
  return (
    <Link
      href={`/problems/${problem.id}`}
      className="group block rounded-2xl border border-line bg-white p-5 shadow-sm shadow-brand-100/60 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <ProblemMeta grade={problem.grade} skill={problem.skill} difficulty={problem.difficulty} />
      <MathText text={problem.statement} className="mt-3 line-clamp-3 block leading-relaxed text-ink" />
      <span className="mt-3 inline-block text-sm font-medium text-brand-700 group-hover:underline">Xem bài →</span>
    </Link>
  );
}
