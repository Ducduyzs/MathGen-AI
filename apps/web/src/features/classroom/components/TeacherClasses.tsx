"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, Plus, School, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { useClasses, useCreateClass } from "../api";
import { GRADES } from "../model";
import { JoinCode } from "./JoinCode";

function CreateClassForm({ onDone }: { onDone: () => void }) {
  const create = useCreateClass();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Tên lớp cần ít nhất 2 ký tự.");
    create.mutate(
      { name: name.trim(), grade: grade ? Number(grade) : null },
      {
        onSuccess: (c) => {
          toast.success(`Đã tạo lớp ${c.name}. Gửi mã ${c.join_code} cho học sinh để vào lớp.`);
          onDone();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-start">
        <div>
          <Label htmlFor="class-name">Tên lớp</Label>
          <Input
            id="class-name"
            autoFocus
            placeholder="Ví dụ: 10A1 · Toán"
            value={name}
            maxLength={120}
            aria-invalid={!!error}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
          />
          <FieldError message={error} />
        </div>
        <div>
          <Label htmlFor="class-grade">Khối</Label>
          <Select id="class-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Không chọn</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Lớp {g}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2 sm:pt-7">
          <Button type="button" variant="ghost" onClick={onDone}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending}>
            Tạo lớp
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function TeacherClasses() {
  const { data, isPending, isError, error, refetch } = useClasses();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Tạo lớp mới
          </Button>
        )}
      </div>
      {creating && <CreateClassForm onDone={() => setCreating(false)} />}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : !data.length ? (
        !creating && (
          <EmptyState
            icon={School}
            title="Chưa có lớp nào"
            description="Tạo lớp, gửi mã lớp cho học sinh, rồi giao bài tập và theo dõi kết quả của cả lớp."
            action={<Button onClick={() => setCreating(true)}>Tạo lớp đầu tiên</Button>}
          />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col p-5">
                <Link href={`/teacher/classes/${c.id}`} className="group flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                    <School className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <CardTitle className="truncate group-hover:text-brand-700">{c.name}</CardTitle>
                    <span className="text-sm text-muted">{c.grade ? `Khối ${c.grade}` : "Chưa chọn khối"}</span>
                  </span>
                  <ChevronRight className="mt-1 size-5 text-muted group-hover:text-brand-600" aria-hidden />
                </Link>
                <div className="mt-4 flex gap-5 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4 text-brand-500" aria-hidden />
                    <strong className="text-ink tabular-nums">{c.member_count}</strong> học sinh
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ClipboardList className="size-4 text-brand-500" aria-hidden />
                    <strong className="text-ink tabular-nums">{c.assignment_count}</strong> bài đã giao
                  </span>
                </div>
                <div className="min-h-4 flex-1" />
                {c.join_code && (
                  <div className="flex items-center gap-2 border-t border-line pt-3 text-sm text-muted">
                    <span className="mr-auto">Mã vào lớp</span>
                    <JoinCode classId={c.id} code={c.join_code} size="sm" />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
