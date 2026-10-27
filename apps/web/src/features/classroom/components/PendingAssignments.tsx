"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, ChevronRight, X } from "lucide-react";
import { useAuth } from "@/features/auth";
import { useMyAssignments } from "../api";
import { dueLabel, isOpen } from "../model";

const DISMISS_KEY = "pending-bar-dismissed";
// Đang làm bài / đang chơi, hoặc đã ở trang Lớp học: không cần nhắc
const HIDDEN_ON = [/^\/exams\/[^/]+/, /^\/arena\/[^/]+/, /^\/classes(\/|$)/];

/**
 * Thanh nhắc trên cùng: học sinh còn bài tập lớp chưa làm (bài hạn gần nhất lên đầu).
 * Đóng thì ẩn trong phiên này, cho tới khi danh sách bài cần làm thay đổi.
 */
export function PendingAssignments() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { data } = useMyAssignments();
  const open = (data ?? []).filter((a) => isOpen(a.status));
  const signature = open.map((a) => a.id).join(",");
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY));
    } catch {
      // sessionStorage bị chặn: thanh vẫn hiện, chỉ không nhớ lần đóng
    }
  }, []);

  if (user?.role !== "student" || !open.length || dismissed === signature) return null;
  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;
  const next = open[0];

  function dismiss() {
    setDismissed(signature);
    try {
      sessionStorage.setItem(DISMISS_KEY, signature);
    } catch {
      // như trên
    }
  }

  return (
    <div role="status" className="flex items-center border-b border-warning-200 bg-warning-50 text-sm text-warning-700 print:hidden">
      <Link href="/classes" className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pr-2 pl-4 hover:underline sm:pl-6">
        <BellRing className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">
          <strong>Bạn có {open.length} bài tập lớp cần làm.</strong>{" "}
          <span className="text-ink">
            Gần nhất: {next.title} ({next.class_name}){next.due_at ? `, ${dueLabel(next.due_at)}` : ""}.
          </span>
        </span>
        <span className="ml-auto hidden shrink-0 items-center gap-0.5 font-semibold sm:flex">
          Xem bài <ChevronRight className="size-4" aria-hidden />
        </span>
      </Link>
      <button
        onClick={dismiss}
        className="mr-2 shrink-0 rounded-md p-1.5 hover:bg-warning-200/60 sm:mr-4"
        aria-label="Ẩn thông báo bài tập"
        title="Ẩn"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
