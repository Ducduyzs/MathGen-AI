"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  Database,
  FileStack,
  FileText,
  Gauge,
  Library,
  LogOut,
  Menu,
  Target,
  TrendingUp,
  Upload,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { ROLE_LABEL, useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";
import { Logo } from "./Logo";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
  /** Các trang con nằm ngoài href nhưng thuộc mục này (báo cáo bài giao thuộc Lớp học). */
  also?: string[];
}

const STUDENT: NavItem[] = [
  { href: "/practice", label: "Luyện tập", icon: Target },
  { href: "/exams", label: "Làm đề", icon: FileText },
  { href: "/classes", label: "Lớp học", icon: Users },
  { href: "/me/progress", label: "Tiến độ", icon: TrendingUp },
  { href: "/problems", label: "Ngân hàng bài", icon: Library },
];

const TEACHER: NavItem[] = [
  { href: "/teacher/review", label: "Duyệt bài", icon: ClipboardCheck },
  { href: "/teacher/uploads", label: "Tải tài liệu", icon: Upload },
  { href: "/teacher/problem-sets", label: "Bộ đề", icon: FileStack, soon: true },
  { href: "/teacher/classes", label: "Lớp học", icon: Users, also: ["/teacher/assignments"] },
  { href: "/problems", label: "Ngân hàng bài", icon: Library },
];

const ADMIN: NavItem[] = [
  { href: "/admin/sources", label: "Nguồn dữ liệu", icon: Database, soon: true },
  { href: "/admin/users", label: "Người dùng", icon: UserCog, soon: true },
  { href: "/admin/quality", label: "Chất lượng", icon: Gauge, soon: true },
];

function sectionsFor(role: Role) {
  if (role === "student") return [{ title: "Học tập", items: STUDENT }];
  if (role === "teacher") return [{ title: "Giảng dạy", items: TEACHER }];
  return [
    { title: "Giảng dạy", items: TEACHER },
    { title: "Quản trị", items: ADMIN },
  ];
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (!user) return null;

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

      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700">
            {user.full_name.trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{user.full_name}</p>
            <p className="text-xs text-muted">
              {ROLE_LABEL[user.role]}
              {user.grade ? ` · Lớp ${user.grade}` : ""}
            </p>
          </div>
          <button onClick={() => void logout()} className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700" aria-label="Đăng xuất" title="Đăng xuất">
            <LogOut className="size-4.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-white lg:block">{sidebar()}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">{sidebar(() => setOpen(false))}</aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink hover:bg-brand-50" aria-label="Mở menu">
          <Menu className="size-5" />
        </button>
        <Logo />
      </header>

      {/* Trang làm đề dùng hết chiều ngang để bảng câu hỏi nằm sát mép phải. */}
      <main className={cn("mx-auto px-4 py-6 sm:px-6 lg:py-8", pathname.startsWith("/exams/") ? "max-w-none" : "max-w-5xl")}>
        {children}
      </main>
    </div>
  );
}
