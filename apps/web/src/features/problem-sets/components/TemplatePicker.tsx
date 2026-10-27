"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkills } from "@/features/exams/api";
import { cn, difficultyLevel, plainText } from "@/lib/utils";
import type { ExamQuestionType, TemplateCount } from "@/types/api";
import { useTemplates } from "../api";
import { GROUP_LABEL, groupOf, TYPE_LABEL, type TemplateGroup } from "../model";

const MAX_PER_TEMPLATE = 20;

interface Props {
  remaining: number;
  pending: boolean;
  onAdd: (items: TemplateCount[]) => void;
}

/** Chọn dạng bài và số câu mỗi dạng; mỗi câu được sinh với số liệu mới. */
export function TemplatePicker({ remaining, pending, onAdd }: Props) {
  const templates = useTemplates();
  const skills = useSkills();
  const [group, setGroup] = useState<TemplateGroup>("basic");
  const [type, setType] = useState<ExamQuestionType | null>(null);
  const [query, setQuery] = useState("");
  const [basket, setBasket] = useState<Record<string, number>>({});

  const skillName = useMemo(() => new Map(skills.data?.map((s) => [s.code, s.name])), [skills.data]);
  const shown = useMemo(() => {
    const q = plainText(query).toLowerCase();
    return (templates.data ?? [])
      .filter((t) => groupOf(t) === group && (!type || t.type === type))
      .filter((t) => !q || plainText(`${t.name} ${skillName.get(t.skill) ?? ""}`).toLowerCase().includes(q))
      .sort((a, b) => a.difficulty - b.difficulty);
  }, [templates.data, group, type, query, skillName]);

  const total = Object.values(basket).reduce((s, n) => s + n, 0);
  const full = total >= remaining;

  function change(code: string, delta: number) {
    setBasket((b) => {
      const n = Math.max(0, Math.min(MAX_PER_TEMPLATE, (b[code] ?? 0) + delta));
      const { [code]: _, ...rest } = b;
      return n ? { ...rest, [code]: n } : rest;
    });
  }

  function add() {
    onAdd(Object.entries(basket).map(([template, count]) => ({ template, count })));
    setBasket({});
  }

  return (
    <Card className="flex flex-col p-4 sm:p-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
      <CardTitle>Thêm câu hỏi</CardTitle>
      <CardDescription className="mt-0.5">Chọn dạng bài và số câu. Mỗi câu được sinh số liệu riêng, kèm đáp án và lời giải.</CardDescription>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1" role="radiogroup" aria-label="Nhóm dạng bài">
        {(Object.keys(GROUP_LABEL) as TemplateGroup[]).map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={group === g}
            onClick={() => setGroup(g)}
            className={cn(
              "h-9 rounded-lg text-[13px] font-medium transition-colors",
              group === g ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip size="sm" selected={type === null} onClick={() => setType(null)}>
          Tất cả
        </Chip>
        {(Object.keys(TYPE_LABEL) as ExamQuestionType[]).map((t) => (
          <Chip key={t} size="sm" selected={type === t} onClick={() => setType(t)}>
            {TYPE_LABEL[t]}
          </Chip>
        ))}
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input aria-label="Tìm dạng bài" placeholder="Tìm dạng bài, chủ đề…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {templates.isPending ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : !shown.length ? (
          <p className="py-6 text-center text-sm text-muted">Không có dạng bài phù hợp.</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((t) => {
              const n = basket[t.code] ?? 0;
              const level = difficultyLevel(t.difficulty);
              return (
                <li key={t.code} className={cn("flex items-center gap-2 py-2.5", n > 0 && "bg-brand-50/60")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{t.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{skillName.get(t.skill) ?? t.skill}</span>
                      <span aria-hidden>·</span>
                      <span>{TYPE_LABEL[t.type]}</span>
                      <Badge tone={level.tone} className="px-1.5 py-0 text-[11px]">
                        {level.label}
                      </Badge>
                    </p>
                  </div>
                  <div className="flex items-center gap-1" role="group" aria-label={`Số câu dạng ${t.name}`}>
                    {n > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => change(t.code, -1)}
                          className="grid size-7 place-items-center rounded-md border border-line bg-white text-muted hover:text-brand-700"
                          aria-label="Bớt một câu"
                        >
                          <Minus className="size-3.5" aria-hidden />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-ink tabular-nums" aria-live="polite">
                          {n}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => change(t.code, 1)}
                      disabled={full || n >= MAX_PER_TEMPLATE}
                      className="grid size-7 place-items-center rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
                      aria-label="Thêm một câu"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <p className="mr-auto text-sm text-muted">
          {total ? (
            <>
              Đã chọn <strong className="text-ink">{total}</strong> câu
            </>
          ) : remaining > 0 ? (
            `Còn thêm được ${remaining} câu`
          ) : (
            "Bộ đề đã đủ 100 câu"
          )}
        </p>
        {total > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setBasket({})}>
            Bỏ chọn
          </Button>
        )}
        <Button size="sm" onClick={add} disabled={!total} loading={pending}>
          Thêm vào bộ đề
        </Button>
      </div>
    </Card>
  );
}
