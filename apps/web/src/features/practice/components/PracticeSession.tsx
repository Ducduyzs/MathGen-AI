"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, CircleX, Repeat, SearchX, X } from "lucide-react";
import { MathText } from "@/components/math";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { ProblemMeta } from "@/components/problem/ProblemMeta";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyGoal } from "@/features/progress";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { parseNumber } from "@/lib/math-input";
import { isTyping } from "@/lib/utils";
import type { AnswerValue, AttemptResult } from "@/types/api";
import { nextProblemOptions, useSubmitAttempt } from "../api";
import { AnswerInput } from "./AnswerInput";
import { FeedbackPanel } from "./FeedbackPanel";
import { HintSteps } from "./HintSteps";
import { SessionSummary } from "./SessionSummary";
import { SessionTrack } from "./SessionTrack";

/** Mỗi phiên 10 câu: có điểm kết thúc rõ ràng thay vì luyện vô tận. */
const SESSION_SIZE = 10;

function isComplete(a: AnswerValue | null): a is AnswerValue {
  if (!a) return false;
  if (a.type === "choice") return a.value !== "";
  if (a.type === "number") return parseNumber(a.value) !== null;
  return a.value.length > 0;
}

export function PracticeSession() {
  const skill = useSearchParams().get("skill");
  // Đổi kỹ năng thì bắt đầu phiên mới.
  return <Session key={skill ?? "auto"} skill={skill} />;
}

function Session({ skill }: { skill: string | null }) {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<{ round: number; similarTo?: string }>({ round: 0 });
  const { data: problem, isPending, isError, error, refetch } = useQuery(
    nextProblemOptions(skill, cursor.round, cursor.similarTo),
  );
  const submit = useSubmitAttempt();

  const [answer, setAnswer] = useState<AnswerValue | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [session, setSession] = useState({ results: [] as boolean[], times: [] as number[], hints: 0, finished: false });
  const startedAt = useRef(0);

  const sessionDone = session.results.length >= SESSION_SIZE;

  useEffect(() => {
    if (problem) startedAt.current = Date.now();
  }, [problem]);

  function goNext(similar = false) {
    setAnswer(null);
    setResult(null);
    setHintsShown(0);
    submit.reset();
    setCursor((c) => ({ round: c.round + 1, similarTo: similar ? problem?.id : undefined }));
  }

  function advance() {
    if (sessionDone) setSession((s) => ({ ...s, finished: true }));
    else goNext();
  }

  function restart() {
    setSession({ results: [], times: [], hints: 0, finished: false });
    goNext();
  }

  // Phím N: sang bài tiếp (hoặc xem tổng kết) sau khi đã có kết quả.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || (e.key !== "n" && e.key !== "N")) return;
      e.preventDefault();
      advanceRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!problem || !isComplete(answer) || submit.isPending || result) return;
    const timeMs = Date.now() - startedAt.current;
    submit.mutate(
      { client_attempt_id: crypto.randomUUID(), problem_id: problem.id, answer, time_ms: timeMs, hints_used: hintsShown },
      {
        onSuccess: (res) => {
          setResult(res);
          setSession((s) => ({
            ...s,
            results: [...s.results, res.is_correct],
            times: [...s.times, timeMs],
            hints: s.hints + hintsShown,
          }));
          void queryClient.prefetchQuery(nextProblemOptions(skill, cursor.round + 1));
        },
      },
    );
  }

  const header = (
    <PageHeader title="Luyện tập" description="Hệ thống chọn bài theo hồ sơ năng lực của bạn." actions={<DailyGoal />} />
  );

  if (session.finished) {
    return (
      <div className="space-y-5">
        {header}
        <SessionSummary results={session.results} times={session.times} hintsUsed={session.hints} onRestart={restart} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {skill && problem && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
          <span>
            Đang luyện kỹ năng: <strong>{problem.skill.name}</strong>
          </span>
          <Link href="/practice" className="ml-auto inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
            <X className="size-4" aria-hidden /> Bỏ chọn
          </Link>
        </div>
      )}

      <SessionTrack results={session.results} size={SESSION_SIZE} />

      {isPending ? (
        <Card className="space-y-4 p-5 sm:p-7">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-8 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </Card>
      ) : isError ? (
        error instanceof ApiError && error.code === "no_problem" ? (
          <EmptyState
            icon={SearchX}
            title="Chưa có bài phù hợp"
            description="Ngân hàng chưa có bài cho kỹ năng này. Hãy luyện theo gợi ý của hệ thống."
            action={
              <Link href="/practice" className={buttonClasses()}>
                Luyện theo gợi ý
              </Link>
            }
          />
        ) : (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        )
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ProblemMeta grade={problem.grade} skill={problem.skill} difficulty={problem.difficulty} />
              {cursor.similarTo && <span className="text-xs font-medium text-brand-700">Bài tương tự</span>}
            </div>
            <MathText text={problem.statement} className="mt-4 block text-lg leading-relaxed sm:text-xl" />

            <div className="mt-6">
              <AnswerInput problem={problem} value={answer} onChange={setAnswer} result={result} />
            </div>

            {!result && problem.hints && (
              <div className="mt-6">
                <HintSteps hints={problem.hints} shown={hintsShown} onReveal={() => setHintsShown((n) => n + 1)} />
              </div>
            )}
          </Card>

          {result && <FeedbackPanel result={result} />}

          {submit.isError && (
            <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {errorMessage(submit.error)}
            </p>
          )}

          {/* Điện thoại: thanh hành động dính đáy để nút luôn trong tầm tay. */}
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {result && (
                <p
                  className={`mr-auto flex items-center gap-1.5 text-sm font-semibold ${result.is_correct ? "text-success-700" : "text-danger-700"}`}
                >
                  {result.is_correct ? <CircleCheck className="size-4.5" aria-hidden /> : <CircleX className="size-4.5" aria-hidden />}
                  {result.is_correct ? "Chính xác!" : "Chưa đúng, xem lời giải bên trên"}
                </p>
              )}

              {!result ? (
                <Button key="submit" type="submit" size="lg" loading={submit.isPending} disabled={!isComplete(answer)} className="max-sm:flex-1">
                  Kiểm tra
                </Button>
              ) : sessionDone ? (
                <Button key="finish" type="button" size="lg" onClick={advance} autoFocus>
                  Xem tổng kết <ArrowRight className="size-4" aria-hidden />
                </Button>
              ) : result.is_correct ? (
                <Button key="next" type="button" size="lg" onClick={advance} autoFocus>
                  Bài tiếp theo <ArrowRight className="size-4" aria-hidden />
                  <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 text-xs font-medium sm:inline">N</kbd>
                </Button>
              ) : (
                <>
                  <Button key="skip" type="button" variant="outline" size="lg" onClick={advance}>
                    Bài khác
                  </Button>
                  <Button key="similar" type="button" size="lg" onClick={() => goNext(true)} autoFocus>
                    <Repeat className="size-4" aria-hidden /> Thử bài tương tự
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
