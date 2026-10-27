"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardCheck, KeyRound, School } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldError, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { useClasses, useJoinClass, useMyAssignments } from "../api";
import { isOpen } from "../model";
import { StudentAssignmentRow } from "./AssignmentRows";

export function JoinClassForm() {
  const router = useRouter();
  const join = useJoinClass();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code.replace(/[^a-z0-9]/gi, "").length < 4) return setError("Nhập mã lớp giáo viên gửi (6 ký tự).");
    join.mutate(code, {
      onSuccess: (c) => {
        toast.success(`Đã vào lớp ${c.name}`);
        setCode("");
        router.push(`/classes/${c.id}`);
      },
      onError: (err) => setError(errorMessage(err)),
    });
  }

  return (
    <Card className="p-5">
      <CardTitle className="flex items-center gap-2">
        <KeyRound className="size-4.5 text-brand-500" aria-hidden /> Vào lớp
      </CardTitle>
      <CardDescription className="mt-0.5">Nhập mã lớp giáo viên gửi để nhận bài tập.</CardDescription>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          aria-label="Mã lớp"
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
        <Button type="submit" loading={join.isPending}>
          Vào lớp
        </Button>
      </form>
      <FieldError message={error} />
    </Card>
  );
}

function MyAssignments() {
  const { data, isPending, isError, error, refetch } = useMyAssignments();
  const [showDone, setShowDone] = useState(false);

  if (isPending) return <Skeleton className="h-56 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const open = data.filter((a) => isOpen(a.status));
  const done = data.filter((a) => !isOpen(a.status));

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <CardTitle className="mr-auto">Bài tập được giao</CardTitle>
        {open.length > 0 && <Badge>{open.length} bài cần làm</Badge>}
      </div>
      {!data.length ? (
        <p className="mt-3 text-sm text-muted">Chưa có bài tập nào. Bài giáo viên giao sẽ hiện ở đây.</p>
      ) : (
        <>
          {open.length ? (
            <ul className="mt-2 divide-y divide-line">
              {open.map((a) => (
                <StudentAssignmentRow key={a.id} a={a} showClass />
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-success-50 p-3 text-sm text-success-700">
              <ClipboardCheck className="size-4.5" aria-hidden /> Bạn đã làm hết bài được giao. Tuyệt vời!
            </p>
          )}
          {done.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setShowDone((s) => !s)}>
                {showDone ? "Ẩn" : "Xem"} {done.length} bài đã nộp / quá hạn
              </button>
              {showDone && (
                <ul className="mt-1 divide-y divide-line">
                  {done.map((a) => (
                    <StudentAssignmentRow key={a.id} a={a} showClass />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function MyClassList() {
  const { data, isPending } = useClasses();
  if (isPending) return <Skeleton className="h-32 rounded-2xl" />;
  if (!data?.length) {
    return <EmptyState icon={School} title="Bạn chưa vào lớp nào" description="Xin mã lớp từ giáo viên rồi nhập vào ô Vào lớp." />;
  }
  return (
    <Card className="p-5">
      <CardTitle>Lớp của tôi</CardTitle>
      <ul className="mt-2 divide-y divide-line">
        {data.map((c) => (
          <li key={c.id}>
            <Link href={`/classes/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-brand-50">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <School className="size-4.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{c.name}</span>
                <span className="text-xs text-muted">
                  {c.teacher_name} · {c.member_count} học sinh
                </span>
              </span>
              {c.pending_count > 0 && <Badge tone="warning">{c.pending_count} bài</Badge>}
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StudentClasses() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <MyAssignments />
      <div className="space-y-5">
        <JoinClassForm />
        <MyClassList />
      </div>
    </div>
  );
}
