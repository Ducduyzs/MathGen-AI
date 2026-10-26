"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { homeFor, useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/problems", label: "Ngân hàng bài" },
  { href: "/practice", label: "Luyện tập" },
];

export function PublicHeader() {
  const { status, user } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="MathGen AI – Trang chủ">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Điều hướng chính">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(l.href) ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-brand-50 hover:text-brand-700",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {status === "authenticated" && user ? (
            <Link href={homeFor(user.role)} className={buttonClasses({ size: "sm" })}>
              Vào học
            </Link>
          ) : status === "guest" ? (
            <>
              <Link href="/login" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                Đăng nhập
              </Link>
              <Link href="/register" className={buttonClasses({ size: "sm" })}>
                Đăng ký
              </Link>
            </>
          ) : (
            <div className="h-9 w-28" aria-hidden />
          )}
        </div>
      </div>
    </header>
  );
}
