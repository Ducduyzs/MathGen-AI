"use client";

import { useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, GraduationCap, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input, Label } from "@/components/ui/input";
import { useSkills } from "@/features/exams/api";
import { EXAM_SIZES } from "@/features/exams/model";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { ExamKind, ExamMode } from "@/types/api";
import { useCreateAssignment } from "../api";

const KINDS: { kind: ExamKind; icon: LucideIcon; title: string; text: string }[] = [
  { kind: "practice", icon: BookOpenCheck, title: "Bài tập ôn luyện", text: "Tự chọn hình thức, số câu, chủ đề và thời gian." },
  { kind: "official", icon: GraduationCap, title: "Đề thi thử THPT", text: "22 câu đúng cấu trúc Bộ GD&ĐT, 90 phút, thang 10." },
];

const DURATIONS = [null, 15, 30, 45, 60, 90];

const DUE_PRESETS = [
  { label: "Không đặt hạn", days: null },
  { label: "Tối mai", days: 1 },
  { label: "3 ngày", days: 3 },
  { label: "1 tuần", days: 7 },
] as const;

/** Giá trị cho <input type="datetime-local">: giờ địa phương, không có múi giờ. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function presetDue(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(22, 0, 0, 0); // hạn nộp mặc định 22:00, học sinh làm bài buổi tối
  return localInput(d);
}

export function AssignmentForm({ classId, onDone }: { classId: string; onDone: () => void }) {
  const skills = useSkills();
  const create = useCreateAssignment();
  const [kind, setKind] = useState<ExamKind>("practice");
  const [mode, setMode] = useState<ExamMode>("choice");
  const [size, setSize] = useState(20);
  const [picked, setPicked] = useState<string[]>([]);
  const [duration, setDuration] = useState<number | null>(30);
  const [due, setDue] = useState(() => presetDue(7));
  const [shuffle, setShuffle] = useState(true);
  const [title, setTitle] = useState("");

  const official = kind === "official";

  function changeMode(m: ExamMode) {
    setMode(m);
    if (!EXAM_SIZES[m].includes(size)) setSize(EXAM_SIZES[m][1]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        classId,
        body: {
          kind,
          title: title.trim() || undefined,
          due_at: due ? new Date(due).toISOString() : null,
          shuffle,
          ...(official ? {} : { mode, size, skills: picked.length ? picked : undefined, duration_minutes: duration }),
        },
      },
      {
        onSuccess: (a) => {
          toast.success(`Đã giao "${a.title}" cho lớp`);
          onDone();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-6">
        <section>
          <CardTitle>Loại bài</CardTitle>
          <div role="radiogroup" aria-label="Loại bài" className="mt-3 grid gap-3 sm:grid-cols-2">
            {KINDS.map((k) => {
              const selected = k.kind === kind;
              return (
                <button
                  key={k.kind}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setKind(k.kind)}
                  className={cn(
                    "flex gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                    "focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none",
                    selected ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-300",
                  )}
                >
                  <k.icon className={cn("mt-0.5 size-5 shrink-0", selected ? "text-brand-600" : "text-muted")} aria-hidden />
                  <span>
                    <span className="block font-semibold text-ink">{k.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{k.text}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {!official && (
          <>
            <section className="grid gap-5 sm:grid-cols-2">
              <div>
                <CardTitle>Hình thức</CardTitle>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip selected={mode === "choice"} onClick={() => changeMode("choice")}>
                    Trắc nghiệm
                  </Chip>
                  <Chip selected={mode === "written"} onClick={() => changeMode("written")}>
                    Tự luận điền đáp số
                  </Chip>
                </div>
              </div>
              <div>
                <CardTitle>Số câu</CardTitle>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXAM_SIZES[mode].map((n) => (
                    <Chip key={n} selected={n === size} onClick={() => setSize(n)}>
                      {n} câu
                    </Chip>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <CardTitle>Chủ đề</CardTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip size="sm" selected={picked.length === 0} onClick={() => setPicked([])}>
                  Tất cả
                </Chip>
                {skills.data?.map((s) => (
                  <Chip
                    key={s.code}
                    size="sm"
                    selected={picked.includes(s.code)}
                    onClick={() => setPicked((p) => (p.includes(s.code) ? p.filter((c) => c !== s.code) : [...p, s.code]))}
                  >
                    {s.name}
                  </Chip>
                ))}
              </div>
            </section>

            <section>
              <CardTitle>Thời gian làm bài</CardTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <Chip key={d ?? "none"} size="sm" selected={d === duration} onClick={() => setDuration(d)}>
                    {d ? `${d} phút` : "Không giới hạn"}
                  </Chip>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <CardTitle>Hạn nộp</CardTitle>
            <div className="mt-3 flex flex-wrap gap-2">
              {DUE_PRESETS.map((p) => {
                const value = p.days === null ? "" : presetDue(p.days);
                return (
                  <Chip key={p.label} size="sm" selected={due === value} onClick={() => setDue(value)}>
                    {p.label}
                  </Chip>
                );
              })}
            </div>
            <Input
              type="datetime-local"
              aria-label="Hạn nộp cụ thể"
              className="mt-2"
              value={due}
              min={localInput(new Date())}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="assignment-title" className="text-base font-semibold">
              Tên bài <span className="font-normal text-muted">(không bắt buộc)</span>
            </Label>
            <Input
              id="assignment-title"
              className="mt-1.5"
              placeholder={official ? "Đề thi tốt nghiệp THPT · Môn Toán" : "Ví dụ: Bài tập tuần 5 · Hàm số"}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 hover:border-brand-300">
              <input type="checkbox" className="mt-1 size-4 accent-brand-600" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              <span>
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <Shuffle className="size-4 text-brand-500" aria-hidden /> Đảo thứ tự câu
                </span>
                <span className="block text-sm text-muted">Mỗi học sinh nhận cùng bộ câu hỏi nhưng thứ tự khác nhau trong từng phần.</span>
              </span>
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
          <p className="mr-auto text-sm text-muted">Câu hỏi được sinh một lần khi giao: cả lớp làm cùng một đề.</p>
          <Button type="button" variant="ghost" onClick={onDone}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending}>
            Giao bài cho lớp
          </Button>
        </div>
      </form>
    </Card>
  );
}
