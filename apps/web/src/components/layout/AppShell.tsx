"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/features/auth";
import { RewardWatcher, StreakXpChip } from "@/features/rewards";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { sectionsFor } from "./nav";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

const WEEKDAY = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });

/** "Chào buổi tối, An" + thứ ngày: tính sau khi mount để giờ máy chủ và trình duyệt không lệch nhau. */
function Greeting({ fullName }: { fullName: string }) {
  const [text, setText] = useState<{ hello: string; date: string } | null>(null);
  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    const part = h < 11 ? "sáng" : h < 13 ? "trưa" : h < 18 ? "chiều" : "tối";
    const date = WEEKDAY.format(now);
    setText({ hello: `Chào buổi ${part}, ${fullName.trim().split(/\s+/).pop()}`, date: date[0].toUpperCase() + date.slice(1) });
  }, [fullName]);
  if (!text) return null;
  return (
    <div className="hidden min-w-0 leading-tight lg:block">
      <p className="truncate font-semibold text-ink">{text.hello}</p>
      <p className="text-xs text-muted">{text.date}</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const student = user.role === "student";

  const sidebar = (onClose?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-line px-5">
        <Link href="/" onClick={onClose}>
          <Logo />
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-brand-50" aria-label="Đóng menu">
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Điều hướng ứng dụng">
        {sectionsFor(user.role).map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-muted uppercase">{section.title}</p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
                const Icon = item.icon;
                if (item.soon) {
                  return (
                    <li key={item.href}>
                      <span className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted/60" aria-disabled>
                        <Icon className="size-4.5" aria-hidden />
                        {item.label}
                        <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">Sắp có</span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-brand-50 hover:text-brand-700",
                      )}
                    >
                      <Icon className={cn("size-4.5", active ? "text-brand-600" : "text-muted")} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

    </div>
  );

  return (
    <div className="min-h-dvh bg-surface lg:pl-64 print:bg-white print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-white lg:block print:hidden">{sidebar()}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">{sidebar(() => setOpen(false))}</aside>
        </div>
      )}

      {/* Thanh trên cùng cao bằng hàng logo của sidebar để đường viền nối liền */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur sm:px-4 lg:h-16 lg:px-6 print:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink hover:bg-brand-50 lg:hidden" aria-label="Mở menu">
          <Menu className="size-5" />
        </button>
        <Link href="/" className="lg:hidden">
          <Logo className={cn(student && "max-sm:[&>span:last-child]:hidden")} />
        </Link>
        <Greeting fullName={user.full_name} />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <CommandPalette />
          {student && <StreakXpChip className="gap-2.5 px-2 max-[359px]:[&>*:last-child]:hidden" />}
          {student && <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />}
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      {student && <RewardWatcher />}

      {/* Trang làm đề dùng hết chiều ngang để bảng câu hỏi nằm sát mép phải. */}
      <main className={cn("mx-auto px-4 py-6 sm:px-6 lg:py-8 print:max-w-none print:p-0", pathname.startsWith("/exams/") ? "max-w-none" : "max-w-5xl")}>
        {children}
      </main>
    </div>
  );
}
