"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Nút mở một khung nổi bên dưới (thông báo, menu tài khoản). Bấm ra ngoài hoặc Esc để đóng.
 * `trigger` nhận trạng thái mở để đổi kiểu nút; `children` nhận hàm đóng (bấm vào một mục thì đóng khung).
 */
export function Popover({
  trigger,
  label,
  children,
  onOpenChange,
  className,
  panelClassName,
}: {
  trigger: (open: boolean) => ReactNode;
  label: string;
  children: (close: () => void) => ReactNode;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const set = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) set(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") set(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button type="button" onClick={() => set(!open)} aria-expanded={open} aria-haspopup="dialog" aria-label={label} title={label}>
        {trigger(open)}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-full right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white shadow-xl shadow-brand-900/10",
            panelClassName,
          )}
        >
          {children(() => set(false))}
        </div>
      )}
    </div>
  );
}
