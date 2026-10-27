"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, CircleCheck, ClipboardCheck, FileText, GitBranch, SkipForward, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { ProblemMeta } from "@/components/problem/ProblemMeta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { isTyping, percent } from "@/lib/utils";
import type { ReviewItem } from "@/types/api";
import { RegionLabel } from "@/features/regions";
import { useReviewDecision, useReviewQueue } from "../api";

const LOW_CONFIDENCE = 0.7;

export function ReviewQueue() {
  const queue = useReviewQueue();
  const decide = useReviewDecision();
  const [index, setIndex] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const items = queue.data ?? [];
  const position = Math.min(index, Math.max(items.length - 1, 0));
  const current: ReviewItem | undefined = items[position];

  function approve() {
    if (!current) return;
    decide.mutate({ id: current.id, body: { decision: "approve" } }, { onSuccess: () => toast.success("Đã duyệt, bài được thêm vào ngân hàng") });
    setRejecting(false);
  }

  function confirmReject() {
    if (!current || reason.trim().length < 3) return;
    decide.mutate({ id: current.id, body: { decision: "reject", reason: reason.trim() } }, { onSuccess: () => toast("Đã từ chối bài") });
    setRejecting(false);
    setReason("");
  }

  function skip() {
    setRejecting(false);
    setIndex((i) => (items.length ? (i + 1) % items.length : 0));
  }

  // Phím tắt A / R / S; ref giữ hàm mới nhất để không phải đăng ký lại listener.
  const actions = useRef({ approve, startReject: () => setRejecting(true), skip });
  actions.current = { approve, startReject: () => setRejecting(true), skip };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "a") actions.current.approve();
      else if (key === "r") actions.current.startReject();
      else if (key === "s") actions.current.skip();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div>
      <PageHeader
        title="Duyệt bài"
        description="Kiểm tra bài do AI trích xuất hoặc sinh ra trước khi đưa vào ngân hàng."
        actions={queue.data && <Badge className="px-3 py-1 text-sm">{items.length} bài đang chờ</Badge>}
      />

      {queue.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : queue.isError ? (
        <ErrorState message={errorMessage(queue.error)} onRetry={() => queue.refetch()} />
      ) : !current ? (
        <EmptyState icon={ClipboardCheck} title="Đã duyệt hết hàng chờ" description="Bài mới sẽ xuất hiện khi pipeline trích xuất hoặc sinh xong." />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>
              Bài {position + 1}/{items.length}
            </span>
            <span className="hidden sm:inline">Phím tắt: A duyệt · R từ chối · S bỏ qua</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <OriginPanel item={current} />
            <CandidatePanel item={current} />
          </div>

          <div className="sticky bottom-0 mt-4 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
            {rejecting ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="reject-reason">Lý do từ chối</Label>
                  <Textarea
                    id="reject-reason"
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ví dụ: Trùng với bài gốc sau khi rút gọn hệ số"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => setRejecting(false)}>
                    Hủy
                  </Button>
                  <Button variant="danger" onClick={confirmReject} disabled={reason.trim().length < 3}>
                    Xác nhận từ chối
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" onClick={skip}>
                  <SkipForward className="size-4" aria-hidden /> Bỏ qua
                </Button>
                <Button variant="dangerOutline" onClick={() => setRejecting(true)}>
                  <X className="size-4" aria-hidden /> Từ chối
                </Button>
                <Button variant="success" onClick={approve}>
                  <Check className="size-4" aria-hidden /> Duyệt
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OriginPanel({ item }: { item: ReviewItem }) {
  const lowConfidence = item.classification_confidence < LOW_CONFIDENCE;
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      {item.origin === "generated" && item.parent ? (
        <section>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-4 text-brand-500" aria-hidden /> Sinh từ bài gốc
          </CardTitle>
          <div className="mt-3 rounded-xl bg-surface p-4">
            <MathText text={item.parent.statement} />
          </div>
          {item.transform && (
            <div className="mt-2 flex items-start gap-2 pl-4 text-sm text-muted">
              <ArrowDown className="mt-0.5 size-4 shrink-0 text-brand-400" aria-hidden />
              <span>
                Luật biến đổi: <MathText text={item.transform} className="text-ink" />
              </span>
            </div>
          )}
        </section>
      ) : (
        <section>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-brand-500" aria-hidden /> Trích từ tài liệu
          </CardTitle>
          {item.source && (
            <p className="mt-3 rounded-xl bg-surface p-4 text-sm">
              <span className="font-medium text-ink">{item.source.name}</span>
              {item.source.page != null && <span className="text-muted"> · trang {item.source.page}</span>}
              {item.source.url && (
                <>
                  <br />
                  {/* Bài do bộ gom lấy về: luôn kèm đường dẫn gốc và giấy phép để người duyệt kiểm tra */}
                  <a href={item.source.url} target="_blank" rel="noreferrer noopener" className="break-all text-brand-700 hover:underline">
                    {item.source.url}
                  </a>
                  {item.source.license && <span className="text-muted"> · Giấy phép: {item.source.license}</span>}
                  <br />
                  <RegionLabel region={item.source} className="mt-1 inline-flex items-center gap-1 text-xs text-muted" />
                </>
              )}
            </p>
          )}
        </section>
      )}

      <section>
        <CardTitle>Phân loại</CardTitle>
        <p className="mt-2 text-sm text-muted">
          Lớp {item.grade} · {item.skill.name} · độ tin cậy{" "}
          <strong className={lowConfidence ? "text-warning-700" : "text-ink"}>{percent(item.classification_confidence)}</strong>
        </p>
        {lowConfidence && (
          <p className="mt-2 flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> Độ tin cậy thấp, hãy kiểm tra lại lớp và kỹ năng.
          </p>
        )}
      </section>

      <section>
        <CardTitle>Kiểm chứng tự động</CardTitle>
        <ul className="mt-3 space-y-2">
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
      </section>
    </Card>
  );
}

function CandidatePanel({ item }: { item: ReviewItem }) {
  return (
    <Card className="border-brand-200 p-5 ring-4 ring-brand-50 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Bài đề xuất</CardTitle>
        <Badge tone={item.origin === "generated" ? "brand" : "neutral"}>{item.origin === "generated" ? "AI sinh" : "Trích xuất"}</Badge>
      </div>
      <div className="mt-3">
        <ProblemMeta grade={item.grade} skill={item.skill} difficulty={item.difficulty} />
      </div>
      <MathText text={item.statement} className="mt-4 block text-lg leading-relaxed" />
      <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3">
        <span className="text-sm font-semibold text-brand-800">Đáp án: </span>
        <MathText text={item.answer_display} />
      </p>
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-muted">Lời giải</p>
        <ol className="list-inside list-decimal space-y-1.5 marker:text-muted">
          {item.solution.map((step, i) => (
            <li key={i}>
              <MathText text={step} />
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
