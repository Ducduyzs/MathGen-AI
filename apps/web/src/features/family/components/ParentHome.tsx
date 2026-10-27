"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Flame, KeyRound, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldError, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { ChildSummary } from "@/types/api";
import { useChildren, useLinkChild } from "../api";
import { lastActiveLabel } from "../model";

function LinkChildForm() {
  const router = useRouter();
  const link = useLinkChild();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code.replace(/[^a-z0-9]/gi, "").length < 4) return setError("Nhập mã 6 ký tự con tạo ở trang Tiến độ.");
    link.mutate(code, {
      onSuccess: (c) => {
        toast.success(`Đã liên kết với ${c.full_name}`);
        setCode("");
        router.push(`/parent/children/${c.id}`);
      },
      onError: (err) => setError(errorMessage(err)),
    });
  }

  return (
    <Card className="p-5">
      <CardTitle className="flex items-center gap-2">
        <KeyRound className="size-4.5 text-brand-500" aria-hidden /> Thêm con
      </CardTitle>
      <CardDescription className="mt-0.5">
        Con đăng nhập tài khoản học sinh, vào <strong>Tiến độ → Phụ huynh theo dõi → Tạo mã liên kết</strong>, rồi đọc mã cho bạn.
      </CardDescription>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          aria-label="Mã liên kết"
          placeholder="VD: K7M2QX"
          value={code}
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={!!error}
          className="font-mono tracking-widest uppercase"
          onChange={(e) => {
            setCode(e.target.value);
            setError(undefined);
          }}
        />
        <Button type="submit" loading={link.isPending}>
          Liên kết
        </Button>
      </form>
      <FieldError message={error} />
    </Card>
  );
}

function ChildCard({ c }: { c: ChildSummary }) {
  const reached = c.today_problems >= c.daily_goal;
  return (
    <Link href={`/parent/children/${c.id}`} className="block">
      <Card className="p-5 transition-colors hover:border-brand-300">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
            {c.full_name.trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink">{c.full_name}</span>
            <span className="text-sm text-muted">
              {c.grade ? `Lớp ${c.grade} · ` : ""}
              {lastActiveLabel(c.last_active)}
            </span>
          </span>
          <ChevronRight className="size-4 text-muted" aria-hidden />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted">Hôm nay</dt>
            <dd className={cn("font-semibold tabular-nums", reached ? "text-success-700" : "text-ink")}>
              {c.today_problems}/{c.daily_goal} bài
            </dd>
          </div>
          <div>
            <dt className="text-muted">7 ngày</dt>
            <dd className="font-semibold text-ink tabular-nums">{c.week_problems} bài</dd>
          </div>
          <div>
            <dt className="text-muted">Chuỗi</dt>
            <dd className="inline-flex items-center gap-1 font-semibold text-ink tabular-nums">
              <Flame className="size-3.5 text-warning-700" aria-hidden /> {c.streak_days} ngày
            </dd>
          </div>
        </dl>
        {(c.pending_assignments > 0 || c.missed_assignments > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {c.pending_assignments > 0 && <Badge>{c.pending_assignments} bài lớp chưa làm</Badge>}
            {c.missed_assignments > 0 && <Badge tone="danger">{c.missed_assignments} bài quá hạn</Badge>}
          </div>
        )}
      </Card>
    </Link>
  );
}

export function ParentHome() {
  const { data, isPending, isError, error, refetch } = useChildren();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        {isPending ? (
          <Skeleton className="h-44 rounded-2xl" />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : !data.length ? (
          <EmptyState icon={Users} title="Chưa liên kết với con" description="Nhập mã liên kết con gửi để xem tiến độ học tập mỗi ngày." />
        ) : (
          data.map((c) => <ChildCard key={c.id} c={c} />)
        )}
      </div>
      <LinkChildForm />
    </div>
  );
}
