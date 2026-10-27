"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileStack, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { timeAgo } from "@/lib/utils";
import type { ProblemSetSummary } from "@/types/api";
import { useCreateSet, useDeleteSet, useDuplicateSet, useProblemSets } from "../api";
import { countsLabel } from "../model";

const SKILLS_SHOWN = 3;

function CreateSetForm() {
  const router = useRouter();
  const create = useCreateSet();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return setError("Đặt tên bộ đề (tối thiểu 2 ký tự).");
    create.mutate(
      { title: title.trim() },
      { onSuccess: (s) => router.push(`/teacher/problem-sets/${s.id}`), onError: (err) => setError(errorMessage(err)) },
    );
  }

  return (
    <Card className="p-5">
      <CardTitle>Soạn bộ đề mới</CardTitle>
      <CardDescription className="mt-0.5">Chọn từng câu theo dạng bài, đổi số liệu, sắp xếp rồi giao cho lớp hoặc in ra giấy.</CardDescription>
      <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
        <Input
          aria-label="Tên bộ đề"
          placeholder="Ví dụ: Kiểm tra 15 phút · Hàm số bậc hai"
          className="min-w-0 flex-1 basis-64"
          maxLength={200}
          value={title}
          aria-invalid={!!error}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(undefined);
          }}
        />
        <Button type="submit" loading={create.isPending}>
          <Plus className="size-4" aria-hidden /> Tạo bộ đề
        </Button>
      </form>
      <FieldError message={error} />
    </Card>
  );
}

function SetCard({ s, onDelete }: { s: ProblemSetSummary; onDelete: () => void }) {
  const duplicate = useDuplicateSet();
  const extra = s.skills.length - SKILLS_SHOWN;

  return (
    <Card className="flex flex-col p-5 transition-colors hover:border-brand-300">
      <Link href={`/teacher/problem-sets/${s.id}`} className="group flex-1">
        <span className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <FileStack className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-ink group-hover:text-brand-700">{s.title}</span>
            <span className="mt-0.5 block text-sm text-muted">{countsLabel(s)}</span>
          </span>
        </span>
        {s.description && <span className="mt-2 line-clamp-2 block text-sm text-muted">{s.description}</span>}
        {s.skills.length > 0 && (
          <span className="mt-3 flex flex-wrap gap-1.5">
            {s.skills.slice(0, SKILLS_SHOWN).map((sk) => (
              <span key={sk.code} className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                {sk.name}
              </span>
            ))}
            {extra > 0 && <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">+{extra}</span>}
          </span>
        )}
      </Link>
      <div className="mt-4 flex items-center gap-1 border-t border-line pt-3">
        <span className="mr-auto text-xs text-muted">Cập nhật {timeAgo(s.updated_at)}</span>
        <Button
          variant="ghost"
          size="sm"
          loading={duplicate.isPending}
          onClick={() =>
            duplicate.mutate(s.id, {
              onSuccess: (c) => toast.success(`Đã tạo "${c.title}"`),
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        >
          <Copy className="size-3.5" aria-hidden /> Nhân bản
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Xóa ${s.title}`}>
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}

export function ProblemSetList() {
  const { data, isPending, isError, error, refetch } = useProblemSets();
  const remove = useDeleteSet();
  const [target, setTarget] = useState<ProblemSetSummary | null>(null);

  return (
    <div className="space-y-5">
      <CreateSetForm />
      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : !data.length ? (
        <EmptyState
          icon={FileStack}
          title="Chưa có bộ đề nào"
          description="Bộ đề dùng lại được nhiều lần: giao cho nhiều lớp, nhân bản để đổi số liệu, hoặc in làm đề kiểm tra trên giấy."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((s) => (
            <SetCard key={s.id} s={s} onDelete={() => setTarget(s)} />
          ))}
        </div>
      )}

      <Dialog
        open={!!target}
        title="Xóa bộ đề?"
        onClose={() => setTarget(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                target &&
                remove.mutate(target.id, {
                  onSuccess: () => {
                    toast.success("Đã xóa bộ đề");
                    setTarget(null);
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Xóa bộ đề
            </Button>
          </>
        }
      >
        &ldquo;{target?.title}&rdquo; sẽ bị xóa. Bài đã giao từ bộ đề này vẫn giữ nguyên.
      </Dialog>
    </div>
  );
}
