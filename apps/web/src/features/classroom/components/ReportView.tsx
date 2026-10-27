"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math";
import { ErrorState } from "@/components/layout/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatScore } from "@/features/exams/model";
import { errorMessage } from "@/lib/api/errors";
import { cn, percent } from "@/lib/utils";
import type { AssignmentReport } from "@/types/api";
import { useAssignmentReport, useDeleteAssignment } from "../api";
import { assignmentMeta, BUCKETS, downloadText, dueLabel, formatDateTime, formatDuration, reportCsv, STATUS } from "../model";

/** Dưới mức này coi là câu / kỹ năng cả lớp cần ôn lại. */
const WEAK = 0.5;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

/** Phổ điểm: một chuỗi số liệu, một màu; số trên đầu cột, di chuột xem chi tiết. */
function Distribution({ counts, total }: { counts: number[]; total: number }) {
  const max = Math.max(1, ...counts);
  return (
    <Card className="p-5">
      <CardTitle>Phổ điểm</CardTitle>
      <p className="text-sm text-muted">Số bài theo khoảng điểm (thang 10)</p>
      <div className="mt-4 flex h-44 items-end gap-0.5 border-b border-line" role="img" aria-label={`Phổ điểm: ${BUCKETS.map((b, i) => `${b} điểm: ${counts[i]} bài`).join(", ")}`}>
        {counts.map((n, i) => (
          <div key={BUCKETS[i]} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-xs font-medium text-ink tabular-nums">{n || ""}</span>
            <div
              className="w-full max-w-14 rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600"
              style={{ height: n ? `${(n / max) * 85}%` : 0 }}
            />
            <span className="pointer-events-none absolute -top-2 z-10 hidden -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block">
              {BUCKETS[i]} điểm: {n} bài{total ? ` (${percent(n / total)})` : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {BUCKETS.map((b) => (
          <span key={b} className="flex-1 text-center text-xs text-muted">
            {b}
          </span>
        ))}
      </div>
    </Card>
  );
}

function RateBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-muted">Chưa có bài nộp</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-brand-50" aria-hidden>
        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${rate * 100}%` }} />
      </span>
      <span className="w-10 text-right text-sm font-semibold text-ink tabular-nums">{percent(rate)}</span>
    </span>
  );
}

function Students({ r }: { r: AssignmentReport }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3">
        <CardTitle>Kết quả từng học sinh</CardTitle>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-surface text-xs text-muted uppercase">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Học sinh</th>
              <th className="px-3 py-2.5 font-semibold">Trạng thái</th>
              <th className="px-3 py-2.5 text-right font-semibold">Điểm</th>
              <th className="px-3 py-2.5 text-right font-semibold">Đúng</th>
              <th className="px-3 py-2.5 font-semibold">Thời gian làm</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.students.map((s) => {
              const done = s.status === "submitted" || s.status === "late";
              return (
                <tr key={s.id} className={cn(done && "hover:bg-brand-50")}>
                  <td className="px-5 py-3 font-medium text-ink">{s.full_name}</td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{s.score !== null ? formatScore(s.score) : "–"}</td>
                  <td className="px-3 py-3 text-right text-muted tabular-nums">{s.correct !== null ? `${s.correct}/${s.total}` : "–"}</td>
                  <td className="px-3 py-3 text-muted">
                    {s.duration_seconds !== null ? formatDuration(s.duration_seconds) : s.started_at ? `Bắt đầu ${formatDateTime(s.started_at)}` : "–"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {done && (
                      <Link
                        href={`/teacher/assignments/${r.assignment.id}/students/${s.id}`}
                        className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-700 hover:underline"
                      >
                        Xem bài <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!r.students.length && <p className="px-5 pb-5 text-sm text-muted">Lớp chưa có học sinh.</p>}
      </div>
    </Card>
  );
}

export function ReportView({ id }: { id: string }) {
  const router = useRouter();
  const { data: r, isPending, isError, error, refetch } = useAssignmentReport(id);
  const del = useDeleteAssignment();
  const [confirming, setConfirming] = useState(false);

  if (isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const { assignment: a, summary: sm } = r;
  const weakQuestions = r.questions.filter((q) => q.correct_rate !== null && q.correct_rate < WEAK).length;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/teacher/classes/${a.class_id}`} className="text-sm text-muted hover:text-brand-700">
          ← {a.class_name}
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{a.title}</h1>
            <p className="mt-1 text-muted">
              {assignmentMeta(a)} · {a.due_at ? `Hạn ${formatDateTime(a.due_at)} (${dueLabel(a.due_at)})` : "Không có hạn nộp"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!r.students.length}
              onClick={() => downloadText(`bang-diem-${a.class_name}-${a.title}.csv`.replace(/[\\/:*?"<>|\s·]+/g, "-"), reportCsv(r))}
            >
              <Download className="size-4" aria-hidden /> Xuất bảng điểm
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label="Xóa bài giao">
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Đã nộp" value={`${sm.submitted_count}/${sm.member_count}`} sub={sm.member_count ? percent(sm.submitted_count / sm.member_count) + " học sinh" : undefined} />
        <Stat label="Điểm trung bình" value={sm.average_score !== null ? formatScore(sm.average_score) : "–"} />
        <Stat
          label="Cao nhất · Thấp nhất"
          value={sm.max_score !== null ? `${formatScore(sm.max_score)} · ${formatScore(sm.min_score ?? 0)}` : "–"}
        />
        <Stat label="Nộp muộn" value={String(sm.late_count)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Distribution counts={sm.distribution} total={sm.submitted_count} />
        <Card className="p-5">
          <CardTitle>Kỹ năng của cả lớp</CardTitle>
          <p className="text-sm text-muted">Yếu nhất ở trên cùng</p>
          <ul className="mt-3 space-y-3">
            {r.skills.map((s) => (
              <li key={s.skill.code} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{s.skill.name}</span>
                  <span className="text-xs text-muted">{s.questions} câu</span>
                </span>
                <RateBar rate={s.correct_rate} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Students r={r} />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-5 pb-3">
          <CardTitle className="mr-auto">Thống kê từng câu</CardTitle>
          {weakQuestions > 0 && (
            <Badge tone="warning">
              <TriangleAlert className="size-3.5" aria-hidden /> {weakQuestions} câu dưới {percent(WEAK)} làm đúng
            </Badge>
          )}
        </div>
        <ol className="divide-y divide-line">
          {r.questions.map((q) => {
            const weak = q.correct_rate !== null && q.correct_rate < WEAK;
            return (
              <li key={q.index} className={cn("grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]", weak && "bg-warning-50/60")}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="rounded-md bg-brand-50 px-2 py-0.5 font-bold text-brand-700">Câu {q.index}</span>
                    {q.template.name} · {q.skill.name}
                    {weak && <Badge tone="warning">Cần ôn lại</Badge>}
                  </p>
                  <MathText text={q.statement} className="mt-2 line-clamp-3 block text-[15px] leading-relaxed text-ink" />
                  <p className="mt-1.5 text-sm text-muted">
                    Đáp án: <MathText text={q.answer_display} className="font-medium text-ink" />
                  </p>
                </div>
                <div className="sm:pt-6">
                  <RateBar rate={q.correct_rate} />
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Dialog
        open={confirming}
        title="Xóa bài giao này?"
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() =>
                del.mutate(a.id, {
                  onSuccess: () => {
                    toast.success("Đã xóa bài giao");
                    router.push(`/teacher/classes/${a.class_id}`);
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Xóa bài giao
            </Button>
          </>
        }
      >
        Báo cáo của bài này sẽ mất. Bài học sinh đã làm vẫn còn trong lịch sử của các em.
      </Dialog>
    </div>
  );
}
