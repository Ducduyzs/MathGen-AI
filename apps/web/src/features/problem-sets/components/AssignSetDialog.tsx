"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useClasses } from "@/features/classroom/api";
import { cn } from "@/lib/utils";

/** Chọn lớp rồi mở form giao bài của lớp đó với bộ đề đã chọn sẵn (đặt hạn nộp, thời gian ở đó). */
export function AssignSetDialog({ setId, open, onClose }: { setId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const classes = useClasses();
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = picked ?? classes.data?.[0]?.id ?? null;

  return (
    <Dialog
      open={open}
      title="Giao bộ đề cho lớp"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!chosen} onClick={() => router.push(`/teacher/classes/${chosen}?set=${encodeURIComponent(setId)}`)}>
            Tiếp tục
          </Button>
        </>
      }
    >
      {classes.isPending ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : !classes.data?.length ? (
        <p>
          Bạn chưa có lớp nào.{" "}
          <Link href="/teacher/classes" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-2" })}>
            Tạo lớp
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm">Chọn lớp, sau đó đặt hạn nộp và thời gian làm bài.</p>
          <ul role="radiogroup" aria-label="Lớp" className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
            {classes.data.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen === c.id}
                  onClick={() => setPicked(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors",
                    chosen === c.id ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-300",
                  )}
                >
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className="text-xs text-muted">{c.member_count} học sinh</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
