"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid, Send } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/layout/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import type { ExamAnswer, ExamResultItem } from "@/types/api";
import { useExam, useSubmitExam } from "../api";
import { answerState, draftKey, maxPoints, sectionLabel, sectionsOf } from "../model";
import { ExamResultPanel } from "./ExamResultPanel";
import { ExamTimer } from "./ExamTimer";
import { QuestionCard } from "./QuestionCard";
import { QuestionNav } from "./QuestionNav";

export function ExamRunner({ id }: { id: string }) {
  const { data: exam, isPending, isError, error, refetch } = useExam(id);
  const submit = useSubmitExam(id);
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [activeIndex, setActiveIndex] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const restored = useRef(false);

  const result = exam?.result ?? null;
  const results = useMemo(() => (result ? new Map<string, ExamResultItem>(result.items.map((i) => [i.question_id, i])) : null), [result]);

  // Bản nháp trong localStorage: tải lại trang hay mất mạng cũng không mất bài đang làm.
  useEffect(() => {
    if (!exam || restored.current) return;
    restored.current = true;
    if (exam.result) {
      // Đề đã nộp: hiện lại bài làm do server lưu (mở trên máy khác, hoặc đã xóa nháp)
      if (exam.answers) setAnswers(exam.answers);
      return;
    }
    try {
      const raw = localStorage.getItem(draftKey(exam.id));
      if (raw) setAnswers(JSON.parse(raw) as Record<string, ExamAnswer>);
    } catch {
      // localStorage bị chặn (chế độ ẩn danh…): làm bài bình thường, chỉ không có nháp.
    }
  }, [exam]);

  useEffect(() => {
    if (!exam || exam.result || !restored.current) return;
    try {
      localStorage.setItem(draftKey(exam.id), JSON.stringify(answers));
    } catch {
      // bỏ qua
    }
  }, [answers, exam]);

  // Đánh dấu câu đang xem trên bảng câu hỏi.
  useEffect(() => {
    if (!exam) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveIndex(Number((visible[0].target as HTMLElement).dataset.index));
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    document.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [exam]);

  const onAnswer = useCallback((questionId: string, value: ExamAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const jump = useCallback((index: number) => {
    setNavOpen(false);
    document.getElementById(`cau-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (isPending) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <Skeleton className="hidden h-96 rounded-2xl xl:order-last xl:block" />
        <div className="mx-auto w-full max-w-4xl space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const unanswered = exam.questions.filter((q) => answerState(q, answers[q.id]) !== "done").length;

  const official = exam.kind === "official";

  function doSubmit() {
    setConfirming(false);
    if (submit.isPending) return;
    submit.mutate(
      { answers },
      {
        onSuccess: () => {
          try {
            localStorage.removeItem(draftKey(id));
          } catch {
            // bỏ qua
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
          toast.success("Đã nộp bài và chấm điểm");
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  function onTimeUp() {
    toast.warning("Hết giờ làm bài, hệ thống tự nộp bài của bạn");
    doSubmit();
  }

  const timer = !result && exam.ends_at && <ExamTimer endsAt={exam.ends_at} onExpire={onTimeUp} />;

  const submitButton = !result && (
    <Button className="w-full" onClick={() => (unanswered ? setConfirming(true) : doSubmit())} loading={submit.isPending}>
      <Send className="size-4" aria-hidden /> Nộp bài
    </Button>
  );

  const nav = (
    <QuestionNav
      kind={exam.kind}
      questions={exam.questions}
      answers={answers}
      results={results}
      activeIndex={activeIndex}
      onJump={jump}
      footer={submitButton}
    />
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
      {/* Máy tính: bảng câu hỏi sát mép phải, đứng yên khi cuộn. */}
      <aside className="hidden xl:order-last xl:block">
        <Card className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto p-4">
          {timer && (
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <span className="text-sm text-muted">Còn lại</span>
              {timer}
            </div>
          )}
          {nav}
        </Card>
      </aside>

      <div className="mx-auto w-full max-w-4xl min-w-0 space-y-5">
        <div>
          <Link href={exam.assignment_id ? "/classes" : "/exams"} className="text-sm text-muted hover:text-brand-700">
            {exam.assignment_id ? "← Lớp học" : "← Làm đề"}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{exam.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {official
              ? `${exam.questions.length} câu · ${exam.duration_minutes} phút · Thang điểm 10 theo cấu trúc của Bộ GD&ĐT`
              : `${exam.questions.length} câu · ${exam.mode === "choice" ? "Chọn A/B/C/D và Đúng/Sai cho từng ý" : "Điền đáp số vào ô trả lời"}`}
          </p>
        </div>

        {/* Điện thoại / máy tính bảng: thanh dính trên cùng, mở bảng câu hỏi khi cần. */}
        <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 xl:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              aria-expanded={navOpen}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink hover:bg-brand-50"
            >
              <LayoutGrid className="size-4 text-brand-600" aria-hidden />
              {result ? `Đúng ${result.correct}/${result.total}` : `Đã làm ${exam.questions.length - unanswered}/${exam.questions.length}`}
              <ChevronDown className={`size-4 transition-transform ${navOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {timer && <span className="ml-auto">{timer}</span>}
            {!result && (
              <Button
                size="sm"
                className={timer ? "" : "ml-auto"}
                onClick={() => (unanswered ? setConfirming(true) : doSubmit())}
                loading={submit.isPending}
              >
                Nộp bài
              </Button>
            )}
          </div>
          {navOpen && <div className="max-h-[60dvh] overflow-y-auto pt-3 pb-2">{nav}</div>}
        </div>

        {result && <ExamResultPanel exam={exam} result={result} />}

        {sectionsOf(exam.questions).map((section) => (
          <section key={section.questions[0].id} className="space-y-4">
            <h2 className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{sectionLabel(section.type, exam.kind)}</h2>
            {section.questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                answer={answers[q.id]}
                onAnswer={onAnswer}
                result={results?.get(q.id)}
                maxPoints={official ? maxPoints(q.type) : undefined}
              />
            ))}
          </section>
        ))}

        {!result && (
          <div className="flex justify-end">
            <Button size="lg" onClick={() => (unanswered ? setConfirming(true) : doSubmit())} loading={submit.isPending}>
              <Send className="size-4" aria-hidden /> Nộp bài
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={confirming}
        title={`Còn ${unanswered} câu chưa làm xong`}
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Làm tiếp
            </Button>
            <Button onClick={doSubmit}>Vẫn nộp bài</Button>
          </>
        }
      >
        Câu bỏ trống hoặc làm dở sẽ bị tính là sai. Bạn có chắc muốn nộp?
      </Dialog>
    </div>
  );
}
