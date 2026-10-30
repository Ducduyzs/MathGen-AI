"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ClipboardCheck, Database, Globe, Library, Target } from "lucide-react";
import { ErrorState } from "@/components/layout/States";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/math";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useQuality } from "../api";

const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const num = new Intl.NumberFormat("vi-VN");

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold text-ink tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}

interface Bar {
  key: string;
  label: string;
  value: number;
  sub?: string;
  low?: boolean;
}

/** Thanh ngang một màu (độ lớn): nhãn trái, giá trị ghi trực tiếp bên phải; `threshold` vẽ vạch đứt mức tối thiểu. */
function BarList({ rows, threshold, empty }: { rows: Bar[]; threshold?: number; empty: string }) {
  if (!rows.length) return <p className="py-4 text-sm text-muted">{empty}</p>;
  const max = Math.max(threshold ?? 0, ...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 text-sm max-sm:grid-cols-[minmax(0,8rem)_1fr_2.5rem]">
          <span className="flex min-w-0 items-center gap-1.5 text-ink" title={r.sub ? `${r.label} · ${r.sub}` : r.label}>
            {r.low && <AlertTriangle className="size-3.5 shrink-0 text-warning-700" aria-label="Thiếu bài" />}
            <span className="truncate">{r.label}</span>
          </span>
          <span className="relative h-2 rounded-full bg-brand-50" title={`${r.label}: ${num.format(r.value)}`}>
            <span className="absolute inset-y-0 left-0 rounded-full bg-brand-500" style={{ width: `${(r.value / max) * 100}%` }} />
            {threshold != null && (
              <span className="absolute -inset-y-1 border-l border-dashed border-muted" style={{ left: `${(threshold / max) * 100}%` }} aria-hidden />
            )}
          </span>
          <span className="text-right font-medium text-ink tabular-nums">{num.format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <CardTitle>{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function QualityDashboard() {
  const { data: q, isPending, isError, error, refetch } = useQuality();
  if (isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  const low = q.coverage.filter((c) => c.low);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Library} label="Bài trong ngân hàng" value={num.format(q.problems_total)} hint={q.by_stage.map((s) => `${s.label}: ${num.format(s.count)}`).join(" · ")} />
        <Stat
          icon={ClipboardCheck}
          label="Đang chờ duyệt"
          value={num.format(q.pending)}
          hint={`30 ngày: duyệt ${q.approved_recent}, từ chối ${q.rejected_recent} (tỉ lệ duyệt ${pct(q.approval_rate)})`}
        />
        <Stat icon={Target} label="Lượt làm 7 ngày" value={num.format(q.attempts_week)} hint={`Đúng ${pct(q.correct_rate_week)} · ${q.active_students_week} học sinh`} />
        <Stat
          icon={Database}
          label="Nhận dạng câu (tài liệu gần đây)"
          value={pct(q.recognition_rate)}
          hint={`${num.format(q.recognized)}/${num.format(q.items)} câu · ${q.documents} tài liệu, ${q.documents_failed} lỗi`}
        />
      </div>

      <Section
        title="Bài nghi sai đáp án"
        description="Bài có từ 5 lượt làm mà tỉ lệ đúng ≤ 25%: thường do đáp án sai, đề lỗi hoặc gắn sai độ khó. Nên kiểm tra lại."
      >
        {q.suspicious.length ? (
          <ul className="divide-y divide-line">
            {q.suspicious.map((s) => (
              <li key={s.problem_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-700">
                  <AlertTriangle className="size-3.5" aria-hidden /> Đúng {pct(s.correct_rate)} / {s.attempts} lượt
                </span>
                <Link href={`/problems/${s.problem_id}`} className="min-w-0 flex-1 truncate text-ink hover:text-brand-700">
                  <MathText text={s.statement} />
                </Link>
                <span className="text-xs text-muted">
                  {s.skill} · lớp {s.grade} · {s.origin}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Chưa phát hiện bài đáng ngờ.</p>
        )}
      </Section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section
          title="Độ phủ theo kỹ năng"
          description={
            low.length
              ? `${low.length} kỹ năng dưới ${q.min_per_skill} bài (vạch đứt): luyện tập dễ lặp bài, nên bổ sung.`
              : `Mọi kỹ năng đều có từ ${q.min_per_skill} bài trở lên.`
          }
        >
          <BarList
            threshold={q.min_per_skill}
            empty="Chưa có kỹ năng."
            rows={q.coverage.map((c) => ({
              key: c.code,
              label: c.name,
              value: c.problems,
              sub: c.grade_min ? `lớp ${c.grade_min}–${c.grade_max}` : undefined,
              low: c.low,
            }))}
          />
        </Section>

        <div className="space-y-5">
          <Section title="Nguồn gốc bài">
            <BarList empty="Chưa có bài." rows={q.by_origin.map((o) => ({ key: o.key, label: o.label, value: o.count }))} />
          </Section>
          <Section title="Đề thật theo tỉnh/thành" description="Bài thu thập từ đề có ghi tỉnh (đơn vị hành chính mới).">
            <BarList empty="Chưa có bài đề thật gắn tỉnh." rows={q.by_province.slice(0, 12).map((p) => ({ key: p.key, label: p.label, value: p.count }))} />
          </Section>
          <Section title="Lý do từ chối (30 ngày)">
            {q.reject_reasons.length ? (
              <ul className="space-y-1.5 text-sm">
                {q.reject_reasons.map((r) => (
                  <li key={r.reason} className="flex gap-3">
                    <span className="min-w-0 flex-1 text-ink">{r.reason}</span>
                    <span className="font-medium text-ink tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Chưa có bài bị từ chối.</p>
            )}
          </Section>
        </div>
      </div>

      <Section
        title="Mô hình phân loại đề (AI)"
        description={
          q.classifier.available
            ? `${q.classifier.base_model} · ${q.classifier.loaded ? "đã nạp" : "nạp khi cần"} · trên ${q.classifier.real_test.n ?? "?"} đề thật: chủ đề ${pct(q.classifier.real_test.topic_acc)}, cấp lớp ${pct(q.classifier.real_test.grade_band_acc)}, lớp đúng / lệch ≤ 1: ${pct(q.classifier.real_test.grade_acc)} / ${pct(q.classifier.real_test.grade_within_1)}`
            : `Đang tắt: ${q.classifier.reason}`
        }
      >
        <p className="text-sm text-muted">Mỗi câu của đề tải lên / thu thập được gắn nhận định chủ đề, lớp, mức độ; hiện cạnh câu và trong hàng chờ duyệt.</p>
      </Section>

      <Section title="Bộ gom" description={`${q.crawl_sources} nguồn (${q.crawl_active_sources} đang bật) · ${q.crawl_jobs} lượt thu thập · ${q.crawl_submitted} câu đã gửi duyệt · ${q.documents_with_region} tài liệu nhận diện được tỉnh`}>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Globe className="size-4" aria-hidden /> Kết quả trang (lần thu thập gần nhất của mỗi URL)
        </div>
        <div className="mt-3">
          <BarList empty="Chưa thu thập trang nào." rows={q.crawl_pages.map((p) => ({ key: p.key, label: p.label, value: p.count }))} />
        </div>
      </Section>
    </div>
  );
}
