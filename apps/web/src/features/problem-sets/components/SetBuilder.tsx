"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { FileStack, PenLine, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { timeAgo } from "@/lib/utils";
import type { ProblemSet } from "@/types/api";
import { useAddQuestions, useProblemSet, useRegenerate, useUpdateSet } from "../api";
import { countsLabel, MAX_SET_QUESTIONS } from "../model";
import { AssignSetDialog } from "./AssignSetDialog";
import { SetQuestionItem } from "./SetQuestionItem";
import { TemplatePicker } from "./TemplatePicker";

function Header({ set }: { set: ProblemSet }) {
  const update = useUpdateSet(set.id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(set.title);
  const [description, setDescription] = useState(set.description ?? "");
  const [assigning, setAssigning] = useState(false);

  function save(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return toast.error("Tên bộ đề tối thiểu 2 ký tự.");
    update.mutate(
      { title: title.trim(), description: description.trim() || null },
      { onSuccess: () => setEditing(false), onError: (err) => toast.error(errorMessage(err)) },
    );
  }

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-3 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <div>
          <Label htmlFor="set-title">Tên bộ đề</Label>
          <Input id="set-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div>
          <Label htmlFor="set-description">
            Ghi chú <span className="font-normal text-muted">(không bắt buộc)</span>
          </Label>
          <Textarea
            id="set-description"
            rows={2}
            maxLength={1000}
            placeholder="Ví dụ: kiểm tra 15 phút chương Hàm số, lớp 10A1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Hủy
          </Button>
          <Button type="submit" loading={update.isPending}>
            Lưu
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
          <span className="min-w-0 break-words">{set.title}</span>
          <button
            type="button"
            onClick={() => {
              setTitle(set.title);
              setDescription(set.description ?? "");
              setEditing(true);
            }}
            className="rounded-lg p-1.5 text-muted hover:bg-brand-50 hover:text-brand-700"
            aria-label="Sửa tên và ghi chú"
            title="Sửa tên và ghi chú"
          >
            <PenLine className="size-4" aria-hidden />
          </button>
        </h1>
        {set.description && <p className="mt-1 text-muted">{set.description}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge>{countsLabel(set)}</Badge>
          <span>Cập nhật {timeAgo(set.updated_at)}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/teacher/problem-sets/${set.id}/print`}
          className={buttonClasses({ variant: "outline", className: set.size ? "" : "pointer-events-none opacity-50" })}
          aria-disabled={!set.size}
        >
          <Printer className="size-4" aria-hidden /> In đề
        </Link>
        <Button onClick={() => setAssigning(true)} disabled={!set.size}>
          <Send className="size-4" aria-hidden /> Giao cho lớp
        </Button>
      </div>
      <AssignSetDialog setId={set.id} open={assigning} onClose={() => setAssigning(false)} />
    </div>
  );
}

/** Soạn bộ đề: danh sách câu (sắp xếp, đổi số liệu, xóa) và bộ chọn dạng bài. */
export function SetBuilder({ id }: { id: string }) {
  const { data: set, isPending, isError, error, refetch } = useProblemSet(id);
  const update = useUpdateSet(id);
  const add = useAddQuestions(id);
  const regenerate = useRegenerate(id);
  const busy = update.isPending || regenerate.isPending;
  const keys = set?.questions.map((q) => q.key);

  const onMove = useCallback(
    (key: string, delta: -1 | 1) => {
      if (!keys) return;
      const order = [...keys];
      const i = order.indexOf(key);
      [order[i], order[i + delta]] = [order[i + delta], order[i]];
      update.mutate({ order }, { onError: (err) => toast.error(errorMessage(err)) });
    },
    [keys, update],
  );

  const onRemove = useCallback(
    (key: string) => {
      if (!keys) return;
      update.mutate(
        { order: keys.filter((k) => k !== key) },
        { onSuccess: () => toast.success("Đã xóa câu khỏi bộ đề"), onError: (err) => toast.error(errorMessage(err)) },
      );
    },
    [keys, update],
  );

  const onRegenerate = useCallback(
    (key: string) =>
      regenerate.mutate(key, { onSuccess: () => toast.success("Đã đổi số liệu câu hỏi"), onError: (err) => toast.error(errorMessage(err)) }),
    [regenerate],
  );

  if (isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <Link href="/teacher/problem-sets" className="text-sm text-muted hover:text-brand-700">
        ← Bộ đề
      </Link>
      <Header key={`${set.title}|${set.description}`} set={set} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {set.questions.length ? (
          <ol className="space-y-3" aria-label="Các câu trong bộ đề">
            {set.questions.map((q, i) => (
              <SetQuestionItem
                key={q.key}
                q={q}
                index={i + 1}
                total={set.questions.length}
                busy={busy}
                onMove={onMove}
                onRegenerate={onRegenerate}
                onRemove={onRemove}
              />
            ))}
          </ol>
        ) : (
          <EmptyState
            icon={FileStack}
            title="Bộ đề chưa có câu nào"
            description="Chọn dạng bài ở khung Thêm câu hỏi. Có thể đổi số liệu, sắp xếp hoặc xóa từng câu sau khi thêm."
          />
        )}
        <TemplatePicker
          remaining={MAX_SET_QUESTIONS - set.size}
          pending={add.isPending}
          onAdd={(items) =>
            add.mutate(items, {
              onSuccess: (s) => toast.success(`Đã thêm câu · bộ đề có ${s.size} câu`),
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        />
      </div>
    </div>
  );
}
