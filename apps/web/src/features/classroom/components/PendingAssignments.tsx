"use client";

import Link from "next/link";
import { BellRing, ChevronRight } from "lucide-react";
import { useAuth } from "@/features/auth";
import { useMyAssignments } from "../api";
import { dueLabel, isOpen } from "../model";

/** Nhắc học sinh còn bài tập lớp chưa làm (bài hạn gần nhất lên đầu). */
export function PendingAssignments() {
  const { user } = useAuth();
  const { data } = useMyAssignments();
  if (user?.role !== "student") return null;
  const open = (data ?? []).filter((a) => isOpen(a.status));
  if (!open.length) return null;
  const next = open[0];

  return (
    <Link
      href="/classes"
      className="flex items-center gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 hover:border-warning-700/40"
    >
      <BellRing className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <strong>
          Bạn có {open.length} bài tập lớp cần làm.
        </strong>{" "}
        <span className="text-ink">
          Gần nhất: {next.title} ({next.class_name}){next.due_at ? `, ${dueLabel(next.due_at)}` : ""}.
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0" aria-hidden />
    </Link>
  );
}
