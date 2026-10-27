"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bell, BellOff, ClipboardCheck, ClipboardList } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { useAuth } from "@/features/auth";
import { dueLabel, dueSoon, isOpen, useMyAssignments } from "@/features/classroom";
import { useReviewQueue } from "@/features/review";
import { cn } from "@/lib/utils";

interface Notice {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  urgent?: boolean;
}

/** Thông báo theo vai trò: học sinh – bài tập lớp chưa làm; giáo viên / quản trị – bài chờ duyệt. */
function useNotices(): Notice[] {
  const { user } = useAuth();
  const student = user?.role === "student";
  const reviewer = user?.role === "teacher" || user?.role === "admin";
  const assignments = useMyAssignments(student);
  const queue = useReviewQueue(reviewer);

  if (student) {
    return (assignments.data ?? [])
      .filter((a) => isOpen(a.status))
      .map((a) => ({
        id: `assignment:${a.id}`,
        icon: ClipboardList,
        title: a.title,
        body: `${a.class_name}${a.due_at ? ` · ${dueLabel(a.due_at)}` : ""}${a.status === "in_progress" ? " · đang làm dở" : ""}`,
        href: `/classes/${a.class_id}`,
        urgent: !!a.due_at && dueSoon(a.due_at),
      }));
  }
  const pending = queue.data?.length ?? 0;
  if (reviewer && pending) {
    return [{ id: `review:${pending}`, icon: ClipboardCheck, title: `${pending} bài chờ duyệt`, body: "Duyệt để đưa vào ngân hàng bài", href: "/teacher/review" }];
  }
  return [];
}

const seenKey = (userId: string) => `notifications-seen:${userId}`;

export function NotificationBell() {
  const { user } = useAuth();
  const notices = useNotices();
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    try {
      setSeen(JSON.parse(localStorage.getItem(seenKey(user.id)) ?? "[]"));
    } catch {
      // localStorage bị chặn: số chưa đọc chỉ không được nhớ qua lần tải trang
    }
  }, [user]);

  const unread = notices.filter((n) => !seen.includes(n.id)).length;

  function markSeen(open: boolean) {
    if (!open || !user || !unread) return;
    const ids = notices.map((n) => n.id);
    setSeen(ids);
    try {
      localStorage.setItem(seenKey(user.id), JSON.stringify(ids));
    } catch {
      // như trên
    }
  }

  return (
    <Popover
      label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
      onOpenChange={markSeen}
      trigger={(open) => (
        <span className={cn("relative grid size-9 place-items-center rounded-lg text-ink hover:bg-brand-50", open && "bg-brand-50 text-brand-700")}>
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger-600 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
      )}
    >
      {(close) => (
        <>
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Thông báo</p>
          {notices.length ? (
            <ul className="max-h-96 overflow-y-auto py-1">
              {notices.map((n) => {
                const Icon = n.icon;
                return (
                  <li key={n.id}>
                    <Link href={n.href} onClick={close} className="flex gap-3 px-4 py-2.5 hover:bg-brand-50">
                      <span
                        className={cn(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                          n.urgent ? "bg-warning-50 text-warning-700" : "bg-brand-50 text-brand-600",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium text-ink">{n.title}</span>
                        <span className={cn("block", n.urgent ? "text-warning-700" : "text-muted")}>{n.body}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex flex-col items-center gap-2 px-4 py-8 text-sm text-muted">
              <BellOff className="size-6" aria-hidden />
              Không có thông báo mới
            </p>
          )}
        </>
      )}
    </Popover>
  );
}
