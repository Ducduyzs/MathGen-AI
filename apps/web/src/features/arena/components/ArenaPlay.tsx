"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Flame, SkipForward, Timer } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NumberAnswer } from "@/features/practice";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { parseNumber } from "@/lib/math-input";
import { cn, isTyping } from "@/lib/utils";
import type { ArenaRun, ExamAnswer } from "@/types/api";
import { arenaKeys, useAnswer, useFinishRun } from "../api";
import { formatClock, POOL_LABEL } from "../model";

const WARN_MS = 30_000;

interface Feedback {
  n: number;
  ok: boolean;
  skipped: boolean;
  points: number;
  display: string;
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Màn chơi: đồng hồ (giờ kết thúc do server cấp), câu hỏi hiện tại, phản hồi ngay sau mỗi câu. */
export function ArenaPlay({ run }: { run: ArenaRun }) {
  const queryClient = useQueryClient();
  const answer = useAnswer(run.id);
  const finish = useFinishRun(run.id);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [value, setValue] = useState("");
  const [stopping, setStopping] = useState(false);
  const finishing = useRef(false);
  const now = useNow(250);
  const q = run.question!;

  const total = run.duration_minutes * 60_000;
  const left = Math.max(0, new Date(run.ends_at).getTime() - now);

  useEffect(() => {
    if (left > 0 || finishing.current) return;
    finishing.current = true;
    finish.mutate(undefined, { onError: () => void queryClient.invalidateQueries({ queryKey: arenaKeys.run(run.id) }) });
  }, [left, finish, queryClient, run.id]);

  function send(given: ExamAnswer | null) {
    if (answer.isPending || left === 0) return;
    answer.mutate(
      { key: q.id, answer: given },
      {
        onSuccess: (r) => {
          setFeedback({ n: run.answered + 1, ok: r.is_correct, skipped: given === null, points: r.points, display: r.correct_answer_display });
          setValue("");
        },
        onError: (err) => {
          // Hết giờ / câu đã chấm: lấy lại trạng thái lượt từ server
          if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: arenaKeys.run(run.id) });
          else toast.error(errorMessage(err));
        },
      },
    );
  }

  // Phím tắt: A–D hoặc 1–4 để chọn đáp án
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (q.type !== "choice") return;
    const keys = (q.choices ?? []).map((c) => c.key);
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const key = keys.includes(k) ? k : keys[Number(k) - 1];
      if (key) sendRef.current({ type: "choice", value: key });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q]);

  function submitNumber(e: FormEvent) {
    e.preventDefault();
    if (parseNumber(value) !== null) send({ type: "number", value: value.trim() });
  }

  const warn = left <= WARN_MS;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="sticky top-14 z-20 -mx-4 bg-surface/95 px-4 pt-1 pb-3 backdrop-blur lg:top-0 lg:mx-0 lg:px-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span
            role="timer"
            aria-label={`Còn ${formatClock(left)}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-lg font-bold tabular-nums",
              warn ? "animate-pulse bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-800",
            )}
          >
            <Timer className="size-5" aria-hidden />
            {formatClock(left)}
          </span>
          <span className="text-sm text-muted">
            Điểm <strong className="text-xl text-ink tabular-nums">{run.score}</strong>
          </span>
          <span className="text-sm text-muted">
            Đúng{" "}
            <strong className="text-ink tabular-nums">
              {run.correct}/{run.answered}
            </strong>
          </span>
          {run.combo >= 2 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-sm font-semibold text-warning-700">
              <Flame className="size-4" aria-hidden /> Chuỗi {run.combo}
            </span>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setStopping(true)}>
            Kết thúc
          </Button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50" aria-hidden>
          <div
            className={cn("h-full rounded-full transition-[width] duration-300", warn ? "bg-danger-600" : "bg-brand-500")}
            style={{ width: `${(left / total) * 100}%` }}
          />
        </div>
      </div>

      {feedback && (
        <p
          key={feedback.n}
          role="status"
          className={cn(
            "flex flex-wrap items-center gap-x-2 rounded-xl px-4 py-2.5 text-sm font-medium",
            feedback.ok ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700",
          )}
        >
          {feedback.ok ? <CircleCheck className="size-4.5" aria-hidden /> : <CircleX className="size-4.5" aria-hidden />}
          {feedback.ok ? (
            <>
              Câu {feedback.n} đúng! <strong>+{feedback.points}</strong>
            </>
          ) : (
            <>
              Câu {feedback.n} {feedback.skipped ? "đã bỏ qua" : "chưa đúng"} · Đáp án: <MathText text={feedback.display} />
            </>
          )}
        </p>
      )}

      <article className="rounded-2xl border border-line bg-white p-5 shadow-sm shadow-brand-100/60 sm:p-6" aria-live="polite">
        <header className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">Câu {q.index}</span>
          <span>{q.template.name}</span>
          <span className="ml-auto">{POOL_LABEL[run.pool]}</span>
        </header>
        <MathText text={q.statement} className="mt-3 block text-[17px] leading-relaxed" />

        {q.type === "choice" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label="Chọn đáp án">
            {(q.choices ?? []).map((c, i) => (
              <button
                key={c.key}
                type="button"
                disabled={answer.isPending}
                onClick={() => send({ type: "choice", value: c.key })}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border-2 border-line bg-white px-4 py-3 text-left transition-colors",
                  "hover:border-brand-400 hover:bg-brand-50 focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none",
                  "disabled:opacity-60",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 font-bold text-brand-700" aria-hidden>
                  {c.key}
                </span>
                <MathText text={c.content} className="min-w-0 flex-1" />
                <kbd className="hidden text-xs text-muted sm:inline">{i + 1}</kbd>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={submitNumber} className="mt-5 flex flex-wrap items-start gap-3">
            <NumberAnswer prefix={q.answer_prefix} value={value} onChange={setValue} label={`Đáp án câu ${q.index}`} />
            <Button type="submit" loading={answer.isPending} disabled={parseNumber(value) === null}>
              Trả lời
            </Button>
          </form>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-xs text-muted">{q.type === "choice" ? "Bấm A–D hoặc 1–4 để trả lời nhanh." : "Nhấn Enter để trả lời."}</p>
          <Button variant="ghost" size="sm" onClick={() => send(null)} disabled={answer.isPending}>
            <SkipForward className="size-4" aria-hidden /> Bỏ qua
          </Button>
        </div>
      </article>

      <Dialog
        open={stopping}
        title="Kết thúc lượt này?"
        onClose={() => setStopping(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setStopping(false)}>
              Chơi tiếp
            </Button>
            <Button
              loading={finish.isPending}
              onClick={() => {
                finishing.current = true;
                finish.mutate(undefined, { onError: (err) => toast.error(errorMessage(err)) });
              }}
            >
              Kết thúc
            </Button>
          </>
        }
      >
        Điểm hiện tại ({run.score}) được ghi vào bảng xếp hạng.
      </Dialog>
    </div>
  );
}
