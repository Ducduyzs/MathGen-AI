"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, Send, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { errorMessage } from "@/lib/api/errors";
import { cn, difficultyLevel } from "@/lib/utils";
import type { DifficultyTarget, ExtractedItem, Variant, VariantFormat } from "@/types/api";
import { useGenerateVariants, useSubmitVariants } from "../api";

const COUNTS = [3, 5, 10];
const TARGETS: { value: DifficultyTarget; label: string }[] = [
  { value: "easier", label: "Dễ hơn" },
  { value: "same", label: "Tương đương" },
  { value: "harder", label: "Khó hơn" },
];
const FORMATS: { value: VariantFormat; label: string }[] = [
  { value: "original", label: "Giữ như đề gốc" },
  { value: "choice", label: "Trắc nghiệm A/B/C/D" },
  { value: "short", label: "Trả lời ngắn" },
];

export function VariantGenerator({ item }: { item: ExtractedItem }) {
  const generate = useGenerateVariants();
  const submit = useSubmitVariants();
  const [count, setCount] = useState(5);
  const [rules, setRules] = useState(() => item.rules.map((r) => r.code));
  const [target, setTarget] = useState<DifficultyTarget>("same");
  const [format, setFormat] = useState<VariantFormat>(item.choices.length ? "choice" : "original");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);

  function toggleRule(code: string) {
    setRules((rs) => (rs.includes(code) ? rs.filter((c) => c !== code) : [...rs, code]));
  }

  function run() {
    generate.mutate(
      { item_id: item.id, count, rules, target, format },
      {
        onSuccess: (vs) => {
          setVariants(vs);
          setSelected(new Set(vs.filter((v) => v.accepted).map((v) => v.id)));
          setSent(false);
          if (!vs.length) toast("Không sinh được biến thể nào với các luật đã chọn. Hãy chọn thêm luật hoặc đổi độ khó.");
        },
      },
    );
  }

  function send() {
    submit.mutate(
      { variant_ids: [...selected] },
      {
        onSuccess: ({ added }) => {
          setSent(true);
          setVariants((vs) => vs.filter((v) => !selected.has(v.id)));
          setSelected(new Set());
          toast.success(`Đã gửi ${added} biến thể vào hàng chờ duyệt`);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  const accepted = variants.filter((v) => v.accepted).length;

  return (
    <div className="mt-4 space-y-5 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Số biến thể</legend>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((n) => (
              <Chip key={n} size="sm" selected={count === n} onClick={() => setCount(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Độ khó so với đề gốc</legend>
          <div className="flex flex-wrap gap-2">
            {TARGETS.map((t) => (
              <Chip key={t.value} size="sm" selected={target === t.value} onClick={() => setTarget(t.value)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Luật biến đổi</legend>
          <div className="flex flex-wrap gap-2">
            {item.rules.map((r) => (
              <span key={r.code} title={r.description}>
                <Chip size="sm" selected={rules.includes(r.code)} onClick={() => toggleRule(r.code)}>
                  {r.label}
                </Chip>
              </span>
            ))}
          </div>
        </fieldset>
        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Hình thức câu hỏi</legend>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <Chip key={f.value} size="sm" selected={format === f.value} onClick={() => setFormat(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {generate.isError && <p className="mr-auto text-sm text-danger-600">{errorMessage(generate.error)}</p>}
        <Button onClick={run} loading={generate.isPending} disabled={!rules.length}>
          <Sparkles className="size-4" aria-hidden /> {variants.length ? "Sinh lại" : "Sinh biến thể"}
        </Button>
      </div>

      {variants.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {accepted}/{variants.length} biến thể qua mọi bước kiểm chứng. Biến thể bị loại không gửi được vào hàng chờ.
          </p>
          <ul className="space-y-3">
            {variants.map((v, i) => (
              <VariantCard
                key={v.id}
                variant={v}
                index={i + 1}
                checked={selected.has(v.id)}
                onToggle={() =>
                  setSelected((s) => {
                    const next = new Set(s);
                    if (next.has(v.id)) next.delete(v.id);
                    else next.add(v.id);
                    return next;
                  })
                }
              />
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="success" onClick={send} loading={submit.isPending} disabled={!selected.size}>
              <Send className="size-4" aria-hidden /> Gửi {selected.size} biến thể vào hàng chờ duyệt
            </Button>
          </div>
        </div>
      )}

      {sent && (
        <p className="flex flex-wrap items-center gap-3 rounded-xl bg-success-50 px-4 py-3 text-sm text-success-700">
          <CircleCheck className="size-4" aria-hidden /> Đã gửi vào hàng chờ. Giáo viên duyệt xong thì bài mới vào ngân hàng.
          <Link href="/teacher/review" className={buttonClasses({ variant: "outline", size: "sm", className: "ml-auto" })}>
            Mở hàng chờ duyệt
          </Link>
        </p>
      )}
    </div>
  );
}

function VariantCard({ variant: v, index, checked, onToggle }: { variant: Variant; index: number; checked: boolean; onToggle: () => void }) {
  const level = difficultyLevel(v.difficulty);
  const id = `variant-${v.id}`;
  return (
    <li className={cn("rounded-xl border bg-white p-4", v.accepted ? "border-line" : "border-danger-200 bg-danger-50/40")}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={!v.accepted}
          onChange={onToggle}
          className="mt-1 size-4 shrink-0 accent-brand-600"
          aria-label={`Chọn biến thể ${index}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-muted">Biến thể {index}</span>
            <Badge tone="neutral">{v.rule.label}</Badge>
            <Badge tone={level.tone}>{level.label}</Badge>
            {v.accepted ? <Badge tone="success">Đạt kiểm chứng</Badge> : <Badge tone="danger">Bị loại</Badge>}
          </div>
          <label htmlFor={id} className="mt-2 block">
            <MathText text={v.statement} className="leading-relaxed" />
          </label>
          {v.choices.length > 0 && (
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {v.choices.map((c) => (
                <li key={c.key}>
                  <span className="font-semibold text-muted">{c.key}.</span> <MathText text={c.content} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">
            <span className="font-semibold text-brand-800">Đáp án: </span>
            <MathText text={v.answer_display} />
          </p>
          <p className="mt-1 text-xs text-muted">
            <MathText text={v.transform} />
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {v.checks.map((c, i) => (
              <li key={i} className={cn("flex items-center gap-1 text-xs", c.passed ? "text-success-700" : "text-danger-700")}>
                {c.passed ? <CircleCheck className="size-3.5" aria-label="Đạt" /> : <TriangleAlert className="size-3.5" aria-label="Không đạt" />}
                <MathText text={c.label} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
