"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const WARN_MS = 5 * 60_000;

function remainingMs(endsAt: string) {
  return Math.max(0, new Date(endsAt).getTime() - Date.now());
}

/** Đếm ngược đến hạn nộp do server cấp; gọi onExpire đúng một lần khi hết giờ. */
export function ExamTimer({ endsAt, onExpire, className }: { endsAt: string; onExpire: () => void; className?: string }) {
  const [left, setLeft] = useState(() => remainingMs(endsAt));
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const tick = () => {
      const ms = remainingMs(endsAt);
      setLeft(ms);
      if (ms === 0 && !expired.current) {
        expired.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  const total = Math.ceil(left / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  const warn = left <= WARN_MS;

  return (
    <span
      role="timer"
      aria-label={`Còn ${mm} phút ${ss} giây`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums",
        warn ? "animate-pulse bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-800",
        className,
      )}
    >
      <Timer className="size-4" aria-hidden />
      {mm}:{ss}
    </span>
  );
}
