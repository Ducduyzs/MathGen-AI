"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

/** Đăng nhập / đăng ký nổi trên trang chủ: Esc, nút đóng hoặc bấm nền để về trang chủ; Tab chỉ chạy trong hộp. */
export function AuthModal({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => router.replace("/", { scroll: false }), [router]);

  useEffect(() => {
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") return close();
    if (e.key !== "Tab" || !panel.current) return;
    const items = panel.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  const onBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) close();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 backdrop-blur-sm" onClick={onBackdrop} onKeyDown={onKeyDown}>
      <div className="flex min-h-full items-center justify-center p-4" onClick={onBackdrop}>
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
          tabIndex={-1}
          className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl outline-none sm:p-8"
        >
          <button type="button" onClick={close} className="absolute top-3 right-3 rounded-lg p-2 text-muted hover:bg-brand-50" aria-label="Đóng">
            <X className="size-5" aria-hidden />
          </button>
          <Logo />
          <h1 id="auth-title" className="mt-5 text-2xl font-bold text-ink">
            {title}
          </h1>
          <p className="mt-1 text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <p className="mt-6 text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
    </div>
  );
}
