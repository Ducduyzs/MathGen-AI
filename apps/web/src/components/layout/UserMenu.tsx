"use client";

import Link from "next/link";
import { Award, ChevronDown, LogOut, TrendingUp } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { ROLE_LABEL, useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";

/** Avatar + tên + vai trò; bấm để xem tài khoản và đăng xuất. Màn hình nhỏ chỉ hiện avatar. */
export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initial = user.full_name.trim().split(/\s+/).pop()?.[0]?.toUpperCase();
  const subtitle = `${ROLE_LABEL[user.role]}${user.grade ? ` · Lớp ${user.grade}` : ""}`;
  const item = "flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-brand-50";

  return (
    <Popover
      label="Tài khoản"
      panelClassName="w-64"
      trigger={(open) => (
        <span className={cn("flex items-center gap-2.5 rounded-lg p-1 text-left hover:bg-brand-50 sm:pr-2", open && "bg-brand-50")}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{initial}</span>
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block max-w-40 truncate text-sm font-medium text-ink">{user.full_name}</span>
            <span className="block text-xs text-muted">{subtitle}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted sm:block" aria-hidden />
        </span>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.full_name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          </div>
          {user.role === "student" && (
            <div className="border-b border-line py-1">
              <Link href="/me/progress" onClick={close} className={item}>
                <TrendingUp className="size-4 text-muted" aria-hidden /> Tiến độ
              </Link>
              <Link href="/me/achievements" onClick={close} className={item}>
                <Award className="size-4 text-muted" aria-hidden /> Thành tích
              </Link>
            </div>
          )}
          <div className="py-1">
            <button
              onClick={() => {
                close();
                void logout();
              }}
              className={cn(item, "w-full text-danger-700 hover:bg-danger-50")}
            >
              <LogOut className="size-4" aria-hidden /> Đăng xuất
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}
