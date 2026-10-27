"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Clock, ListChecks, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { ExamMode } from "@/types/api";
import { useCreateExam, useSkills } from "../api";
import { useAuth } from "@/features/auth";
import { skillInStage } from "@/lib/grades";
import { EXAM_SIZES, MINUTES_PER_QUESTION } from "../model";
import { RegionPicker, type RegionValue } from "./RegionPicker";

const MODES: { mode: ExamMode; icon: LucideIcon; title: string; text: string }[] = [
  { mode: "choice", icon: ListChecks, title: "Trắc nghiệm", text: "Phần I chọn A/B/C/D, Phần II chọn Đúng/Sai cho từng ý a, b, c, d." },
  { mode: "written", icon: PenLine, title: "Tự luận", text: "Tự giải rồi điền đáp số (số nguyên, thập phân hoặc phân số)." },
];

export function ExamBuilder() {
  const router = useRouter();
  const { user } = useAuth();
  const skills = useSkills();
  // Học sinh chỉ thấy chủ đề đúng cấp học; giáo viên thấy tất cả
  const shown = skills.data?.filter((s) => user?.role !== "student" || skillInStage(s, user.grade));
  const create = useCreateExam();
  const [mode, setMode] = useState<ExamMode>("choice");
  const [size, setSize] = useState(20);
  const [picked, setPicked] = useState<string[]>([]);
  // Mặc định theo tỉnh của học sinh (nếu đã khai báo khi đăng ký)
  const [region, setRegion] = useState<RegionValue>({ province: user?.province_code ?? "", school: "" });

  function changeMode(m: ExamMode) {
    setMode(m);
    if (!EXAM_SIZES[m].includes(size)) setSize(EXAM_SIZES[m][1]);
  }

  function toggleSkill(code: string) {
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  }

  const minutes = Math.round(size * MINUTES_PER_QUESTION[mode]);

  return (
    <Card className="space-y-7 p-5 sm:p-7">
      <section>
        <CardTitle>Hình thức</CardTitle>
        <div role="radiogroup" aria-label="Hình thức đề" className="mt-3 grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => {
            const selected = m.mode === mode;
            return (
              <button
                key={m.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => changeMode(m.mode)}
                className={cn(
                  "flex gap-4 rounded-2xl border-2 p-4 text-left transition-colors",
                  "focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none",
                  selected ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-300",
                )}
              >
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", selected ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600")}>
                  <m.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{m.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{m.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <CardTitle>Số câu</CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAM_SIZES[mode].map((n) => (
            <Chip key={n} selected={n === size} onClick={() => setSize(n)}>
              {n} câu
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <CardTitle>Chủ đề</CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip selected={picked.length === 0} onClick={() => setPicked([])}>
            Tất cả
          </Chip>
          {shown?.map((s) => (
            <Chip key={s.code} selected={picked.includes(s.code)} onClick={() => toggleSkill(s.code)}>
              {s.name}
            </Chip>
          ))}
        </div>
      </section>

      <RegionPicker value={region} onChange={setRegion} />

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
        <p className="mr-auto flex items-center gap-2 text-sm text-muted">
          <Clock className="size-4 text-brand-500" aria-hidden /> Thời gian gợi ý khoảng <strong className="text-ink">{minutes} phút</strong>
        </p>
        {create.isError && <p className="w-full text-sm text-danger-600 sm:order-first">{errorMessage(create.error)}</p>}
        <Button
          size="lg"
          loading={create.isPending}
          onClick={() =>
            create.mutate(
              {
                mode,
                size,
                skills: picked.length ? picked : undefined,
                province: region.province || undefined,
                school_id: region.school || undefined,
              },
              { onSuccess: (exam) => router.push(`/exams/${exam.id}`) },
            )
          }
        >
          Tạo đề {size} câu
        </Button>
      </div>
    </Card>
  );
}
