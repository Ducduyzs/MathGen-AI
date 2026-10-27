"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock, LockOpen, Pencil, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABEL, useAuth } from "@/features/auth";
import { errorMessage } from "@/lib/api/errors";
import { provinceName } from "@/lib/regions";
import { cn, timeAgo } from "@/lib/utils";
import type { AdminUser, Role } from "@/types/api";
import { useAdminUsers, useUpdateUser } from "../api";
import { PasswordDialog, UserDialog } from "./UserDialog";

const FILTERS: (Role | "")[] = ["", "student", "teacher", "parent", "admin"];
const ROLE_TONE: Record<Role, "brand" | "success" | "warning" | "neutral"> = { student: "brand", teacher: "success", parent: "neutral", admin: "warning" };

export function UsersAdmin() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null | undefined>(undefined); // undefined: đóng, null: tạo mới
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const { data, isPending, isError, error, refetch, isFetching } = useAdminUsers(q, role, page);
  const update = useUpdateUser();

  // Gõ xong 300 ms mới tìm, về trang 1
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const total = data ? Object.values(data.counts).reduce((s, n) => s + (n ?? 0), 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  function toggleLock(u: AdminUser) {
    update.mutate(
      { id: u.id, disabled: !u.disabled },
      { onSuccess: (r) => toast.success(r.disabled ? `Đã khóa ${r.email}` : `Đã mở khóa ${r.email}`), onError: (e) => toast.error(errorMessage(e)) },
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((r) => (
          <button
            key={r || "all"}
            type="button"
            aria-pressed={role === r}
            onClick={() => {
              setRole(r);
              setPage(1);
            }}
            className={cn(
              "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
              role === r ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line bg-white text-ink hover:border-brand-300",
            )}
          >
            <span className="block text-xs text-muted">{r ? ROLE_LABEL[r] : "Tất cả"}</span>
            <span className="text-lg font-bold tabular-nums">{data ? (r ? (data.counts[r] ?? 0) : total) : "…"}</span>
          </button>
        ))}
        {data && data.disabled > 0 && (
          <span className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            <span className="block text-xs">Đang khóa</span>
            <span className="text-lg font-bold tabular-nums">{data.disabled}</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo họ tên hoặc email…" aria-label="Tìm người dùng" className="pl-9" />
        </div>
        <Button onClick={() => setEditing(null)}>
          <UserPlus className="size-4" aria-hidden /> Tạo tài khoản
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !data.items.length ? (
        <EmptyState icon={Users} title="Không có người dùng phù hợp" description="Thử đổi từ khóa hoặc bộ lọc vai trò." />
      ) : (
        <Card className={cn("overflow-hidden transition-opacity", isFetching && "opacity-70")}>
          <ul className="divide-y divide-line">
            {data.items.map((u) => (
              <li key={u.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", u.disabled && "bg-danger-50/40")}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {u.full_name.trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
                </span>
                <div className="min-w-48 flex-1">
                  <p className="font-medium text-ink">
                    {u.full_name}
                    {u.id === me?.id && <span className="font-normal text-muted"> (bạn)</span>}
                  </p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  {u.grade && <Badge tone="neutral">Lớp {u.grade}</Badge>}
                  {u.province_code && <Badge tone="neutral">{provinceName(u.province_code)}</Badge>}
                  {u.disabled && (
                    <Badge tone="danger">
                      <Lock className="size-3" aria-hidden /> Đã khóa
                    </Badge>
                  )}
                </div>
                <p className="w-36 text-xs text-muted max-sm:w-auto">{u.last_login ? `Đăng nhập ${timeAgo(u.last_login)}` : "Chưa đăng nhập"}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(u)} title="Sửa" aria-label={`Sửa ${u.full_name}`}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setResetting(u)} title="Đặt lại mật khẩu" aria-label={`Đặt lại mật khẩu ${u.full_name}`}>
                    <KeyRound className="size-4" aria-hidden />
                  </Button>
                  {u.id !== me?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className={u.disabled ? "text-success-700" : "text-danger-700"}
                      onClick={() => toggleLock(u)}
                      title={u.disabled ? "Mở khóa" : "Khóa tài khoản"}
                      aria-label={`${u.disabled ? "Mở khóa" : "Khóa"} ${u.full_name}`}
                    >
                      {u.disabled ? <LockOpen className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
              <span className="text-muted tabular-nums">
                {data.total} người · trang {page}/{pages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Trước
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Sau
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {editing !== undefined && <UserDialog key={editing?.id ?? "new"} open user={editing} onClose={() => setEditing(undefined)} />}
      {resetting && <PasswordDialog key={resetting.id} user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}
