"use client";

import Link from "next/link";
import { ErrorState } from "@/components/layout/States";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionCard } from "@/features/exams/components/QuestionCard";
import { formatScore, maxPoints, sectionLabel, sectionsOf } from "@/features/exams/model";
import { errorMessage } from "@/lib/api/errors";
import { useAssignmentReport, useSubmission } from "../api";
import { formatDateTime, formatDuration } from "../model";

const noop = () => {};

/** Giáo viên xem lại bài làm của một học sinh (chỉ đọc). */
export function SubmissionView({ assignmentId, studentId }: { assignmentId: string; studentId: string }) {
  const { data: exam, isPending, isError, error, refetch } = useSubmission(assignmentId, studentId);
  const report = useAssignmentReport(assignmentId);
  const student = report.data?.students.find((s) => s.id === studentId);

  if (isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const result = exam.result!;
  const items = new Map(result.items.map((i) => [i.question_id, i]));
  const official = exam.kind === "official";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href={`/teacher/assignments/${assignmentId}`} className="text-sm text-muted hover:text-brand-700">
          ← Báo cáo bài tập
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{student?.full_name ?? "Bài làm của học sinh"}</h1>
        <p className="mt-1 text-muted">{exam.title}</p>
      </div>

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div>
          <p className="text-sm text-muted">Điểm</p>
          <p className="text-3xl font-bold text-brand-700 tabular-nums">{formatScore(result.score)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Số câu đúng</p>
          <p className="text-xl font-semibold text-ink tabular-nums">
            {result.correct}/{result.total}
          </p>
        </div>
        {result.parts.map((p) => (
          <div key={p.label}>
            <p className="text-sm text-muted">{p.label}</p>
            <p className="text-xl font-semibold text-ink tabular-nums">
              {formatScore(p.earned)}/{formatScore(p.max)}
            </p>
          </div>
        ))}
        <div className="text-sm text-muted sm:ml-auto sm:text-right">
          <p>Nộp lúc {formatDateTime(result.submitted_at)}</p>
          {student?.duration_seconds != null && <p>Làm trong {formatDuration(student.duration_seconds)}</p>}
        </div>
      </Card>

      {sectionsOf(exam.questions).map((section) => (
        <section key={section.questions[0].id} className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{sectionLabel(section.type, exam.kind)}</h2>
          {section.questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              answer={exam.answers?.[q.id]}
              onAnswer={noop}
              result={items.get(q.id)}
              maxPoints={official ? maxPoints(q.type) : undefined}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
