"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck, Copy, Sparkles, TriangleAlert } from "lucide-react";
import { MathText } from "@/components/math";
import { ProblemMeta } from "@/components/problem/ProblemMeta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, percent } from "@/lib/utils";
import type { ExtractedItem } from "@/types/api";
import { AiChip } from "@/features/classifier";
import { VariantGenerator } from "./VariantGenerator";

/** Một câu đã tách từ đề: kết quả nhận dạng, lời giải, kiểm chứng, và nút sinh biến thể. */
export function ItemCard({ item }: { item: ExtractedItem }) {
  const [open, setOpen] = useState(false);
  const recognized = item.status === "recognized" && item.structure;
  const canGenerate = recognized && item.rules.length > 0;

  return (
    <Card id={`cau-${item.index}`} className={cn("scroll-mt-24 p-5 sm:p-6", !recognized && "bg-surface/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">Câu {item.index}</span>
        {recognized ? (
          <Badge tone="brand">{item.structure!.kind_label}</Badge>
        ) : (
          <Badge tone="neutral">Chưa hỗ trợ</Badge>
        )}
        <AiChip prediction={item.ai} />
        {item.duplicate_of && (
          <Badge tone="warning">
            <Copy className="size-3" aria-hidden /> Trùng với {item.duplicate_of}
          </Badge>
        )}
        {recognized && <span className="ml-auto text-xs text-muted">Độ tin cậy {percent(item.confidence)}</span>}
      </div>

      <MathText text={item.statement} className="mt-3 block leading-relaxed" />
      {item.choices.length > 0 && (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {item.choices.map((c) => (
            <li
              key={c.key}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm",
                item.matched_choice === c.key ? "border-success-200 bg-success-50 text-success-700" : "border-line",
              )}
            >
              <span className="font-semibold">{c.key}.</span> <MathText text={c.content} />
              {item.matched_choice === c.key && <CircleCheck className="ml-1.5 inline size-4" aria-label="Khớp lời giải" />}
            </li>
          ))}
        </ul>
      )}

      {!recognized ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
          {item.reason ?? "Dạng bài này chưa nằm trong các dạng pipeline xử lý được."} Câu này vẫn có thể được giáo viên nhập tay.
        </p>
      ) : (
        <>
          {item.grade && item.skill && item.difficulty !== null && (
            <div className="mt-4">
              <ProblemMeta grade={item.grade} skill={item.skill} difficulty={item.difficulty} />
            </div>
          )}
          <dl className="mt-4 grid gap-3 rounded-xl bg-surface p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-muted uppercase">Dạng tổng quát</dt>
              <dd className="mt-1">
                <MathText text={`$${item.structure!.general_form}$`} />
              </dd>
              <dd className="mt-1 text-muted">
                <MathText text={item.structure!.params.map((p) => `$${p.name} = ${p.value}$`).join(", ")} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted uppercase">Dạng chuẩn</dt>
              <dd className="mt-1">
                <MathText text={`$${item.structure!.canonical}$`} />
              </dd>
              <dd className="mt-1 font-mono text-xs text-muted" title="Mã băm dạng chuẩn, dùng để chống trùng">
                #{item.structure!.hash.slice(0, 10)}
              </dd>
            </div>
          </dl>
          {item.answer_display && (
            <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3">
              <span className="text-sm font-semibold text-brand-800">Đáp án: </span>
              <MathText text={item.answer_display} />
            </p>
          )}

          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              Lời giải và kiểm chứng ({item.checks.filter((c) => c.passed).length}/{item.checks.length} đạt)
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <ol className="list-inside list-decimal space-y-1.5 text-sm marker:text-muted">
                {item.solution.map((step, i) => (
                  <li key={i}>
                    <MathText text={step} />
                  </li>
                ))}
              </ol>
              <ul className="space-y-1.5">
                {item.checks.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {c.passed ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-600" aria-label="Đạt" />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-label="Cảnh báo" />
                    )}
                    <MathText text={c.label} className={c.passed ? "text-ink" : "text-warning-700"} />
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </>
      )}

      {canGenerate && (
        <div className="mt-4 border-t border-line pt-4">
          <Button variant={open ? "ghost" : "secondary"} size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Sparkles className="size-4" aria-hidden /> {open ? "Thu gọn" : "Sinh biến thể từ câu này"}
          </Button>
          {open && <VariantGenerator item={item} />}
        </div>
      )}
    </Card>
  );
}
