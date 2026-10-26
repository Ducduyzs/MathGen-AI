import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted">
          <span>© 2026 MathGen AI · Đề tài thực tập</span>
          <span>Toán lớp 6–12 · Đại số</span>
        </div>
      </footer>
    </div>
  );
}
