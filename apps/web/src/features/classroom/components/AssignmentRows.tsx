"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronRight, GraduationCap, ListChecks, PenLine, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { formatScore } from "@/features/exams/model";
import { errorMessage } from "@/lib/api/errors";
import { cn, percent } from "@/lib/utils";
import type { Assignment } from "@/types/api";
import { useStartAssignment } from "../api";
import { assignmentMeta, dueLabel, dueSoon, formatDateTime, isOpen, STATUS } from "../model";

function KindIcon({ a }: { a: Assignment }) {
  const Icon = a.kind === "official" ? GraduationCap : a.mode === "choice" ? ListChecks : PenLine;
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function Due({ a, open }: { a: Assignment; open: boolean }) {
  if (!a.due_at) return <span>Không có hạn nộp</span>;
  const soon = open && dueSoon(a.due_at);
  return (
    <span className={cn("inline-flex items-center gap-1", soon && "font-medium text-warning-700")}>
      <CalendarClock className="size-3.5" aria-hidden />
      Hạn {formatDateTime(a.due_at)}
      {open && ` · ${dueLabel(a.due_at)}`}
    </span>
  );
}

/** Một bài giao, nhìn từ phía học sinh: trạng thái, điểm và nút làm bài. */
export function StudentAssignmentRow({ a, showClass = false }: { a: Assignment; showClass?: boolean }) {
  const router = useRouter();
  const start = useStartAssignment();
  const status = a.status ?? "todo";
  const open = isOpen(status);

  function go() {
    if (a.exam_id) return router.push(`/exams/${a.exam_id}`);
    start.mutate(a.id, {
      onSuccess: ({ exam_id }) => router.push(`/exams/${exam_id}`),
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3.5">
      <KindIcon a={a} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{a.title}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          {showClass && <span className="font-medium text-brand-700">{a.class_name}</span>}
          <span>{assignmentMeta(a)}</span>
          <Due a={a} open={open} />
        </p>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        {a.score !== null && a.score !== undefined ? (
          <Badge tone={a.score >= 8 ? "success" : a.score >= 5 ? "brand" : "danger"}>{formatScore(a.score)} điểm</Badge>
        ) : (
          <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
        )}
        {status === "late" && <Badge tone="warning">Nộp muộn</Badge>}
        {open ? (
          <Button size="sm" onClick={go} loading={start.isPending}>
            <Play className="size-3.5" aria-hidden /> {status === "in_progress" ? "Làm tiếp" : "Làm bài"}
          </Button>
        ) : a.exam_id ? (
          <Link href={`/exams/${a.exam_id}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
            <RotateCcw className="size-3.5" aria-hidden /> Xem lại
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/** Một bài giao, nhìn từ phía giáo viên: tiến độ nộp bài của lớp. */
export function TeacherAssignmentRow({ a }: { a: Assignment }) {
  const members = a.member_count ?? 0;
  const submitted = a.submitted_count ?? 0;
  const ratio = members ? submitted / members : 0;
  const open = !a.due_at || new Date(a.due_at).getTime() > Date.now();

  return (
    <li>
      <Link href={`/teacher/assignments/${a.id}`} className="-mx-2 flex flex-wrap items-center gap-3 rounded-xl px-2 py-3.5 hover:bg-brand-50">
        <KindIcon a={a} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{a.title}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>{assignmentMeta(a)}</span>
            <Due a={a} open={open} />
          </p>
        </div>
        <div className="flex w-full items-center gap-4 pl-13 sm:w-auto sm:pl-0">
          <div className="w-36">
            <p className="flex justify-between text-xs text-muted">
              <span>Đã nộp</span>
              <span className="font-medium text-ink tabular-nums">
                {submitted}/{members}
              </span>
            </p>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-50"
              role="progressbar"
              aria-label="Tỉ lệ học sinh đã nộp"
              aria-valuenow={Math.round(ratio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              title={percent(ratio)}
            >
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>
          <div className="w-20 text-right">
            <p className="text-xs text-muted">Điểm TB</p>
            <p className="font-semibold text-ink tabular-nums">{a.average_score != null ? formatScore(a.average_score) : "–"}</p>
          </div>
        </div>
        <ChevronRight className="hidden size-4 text-muted sm:block" aria-hidden />
      </Link>
    </li>
  );
}
