"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CircleCheck, CircleSlash, ClipboardPaste, FileUp, LoaderCircle, Wand2, X } from "lucide-react";
import { MathText } from "@/components/math";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useCreateSource, useSource, useSources } from "@/features/ingestion";
import { errorMessage } from "@/lib/api/errors";
import { cn, timeAgo } from "@/lib/utils";
import type { ExamMode, SimilarExamRequest } from "@/types/api";
import { useCreateSimilarExam } from "../api";

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,.txt";
const MAX_MB = 20;
const TARGETS: { value: SimilarExamRequest["target"]; label: string }[] = [
  { value: "easier", label: "Dễ hơn" },
  { value: "same", label: "Tương đương" },
  { value: "harder", label: "Khó hơn" },
];

/** Bước 1: đưa đề thầy cô cho vào (ảnh chụp, PDF, Word hoặc dán chữ). */
function SourceInput({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useCreateSource();
  const recent = useSources();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    const ok = /\.(pdf|docx|png|jpe?g|txt)$/i.test(f.name) && f.size <= MAX_MB * 1024 * 1024;
    setError(ok ? null : `Chỉ nhận PDF, Word (.docx), ảnh JPG/PNG hoặc .txt, tối đa ${MAX_MB} MB.`);
    setFile(ok ? f : null);
  }

  function submit() {
    const input = tab === "file" && file ? { name: name.trim() || file.name, file } : { name: name.trim() || "Đề thầy cô cho", text };
    create.mutate(input, { onSuccess: (src) => onCreated(src.id), onError: (e) => setError(errorMessage(e)) });
  }

  const ready = tab === "file" ? !!file : text.trim().length > 10;
  return (
    <Card className="space-y-5 p-5 sm:p-7">
      <div>
        <CardTitle>Đề thầy cô cho</CardTitle>
        <CardDescription>
          Chụp ảnh hoặc tải đề lên; hệ thống nhận ra từng câu thuộc dạng nào rồi sinh câu tương tự (đổi số liệu, có đáp án và lời giải) để bạn luyện thêm.
        </CardDescription>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip selected={tab === "file"} onClick={() => setTab("file")}>
          <FileUp className="size-4" aria-hidden /> Ảnh / PDF / Word
        </Chip>
        <Chip selected={tab === "text"} onClick={() => setTab("text")}>
          <ClipboardPaste className="size-4" aria-hidden /> Dán chữ
        </Chip>
      </div>

      {tab === "file" ? (
        <div className="rounded-2xl border-2 border-dashed border-line p-5 text-center">
          {file ? (
            <p className="flex items-center justify-center gap-2 text-sm text-ink">
              <FileUp className="size-4 text-brand-600" aria-hidden /> {file.name}
              <button type="button" onClick={() => setFile(null)} className="rounded p-1 text-muted hover:bg-brand-50" aria-label="Bỏ file">
                <X className="size-4" />
              </button>
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <FileUp className="size-4" aria-hidden /> Chọn file
              </Button>
              {/* Điện thoại: mở thẳng camera để chụp đề */}
              <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()}>
                <Camera className="size-4" aria-hidden /> Chụp ảnh đề
              </Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">PDF (kể cả bản scan), Word, ảnh JPG/PNG · tối đa {MAX_MB} MB. Ảnh nên chụp thẳng, đủ sáng.</p>
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      ) : (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-40 font-mono text-sm"
          placeholder={"Câu 1. Giải phương trình 3x - 12 = 0.\nCâu 2. Giải phương trình x^2 - 7x + 10 = 0."}
          aria-label="Nội dung đề"
        />
      )}
      <div>
        <Label htmlFor="sim-name">Tên đề (tùy chọn)</Label>
        <Input id="sim-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Đề kiểm tra 15 phút thầy Nam" />
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button size="lg" onClick={submit} disabled={!ready} loading={create.isPending}>
        <Wand2 className="size-4.5" aria-hidden /> Phân tích đề
      </Button>

      {!!recent.data?.length && (
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium text-ink">Đề đã tải lên</p>
          <div className="flex flex-wrap gap-2">
            {recent.data.slice(0, 6).map((s) => (
              <Chip key={s.id} size="sm" selected={false} onClick={() => onCreated(s.id)}>
                {s.name} · {s.stats.recognized}/{s.stats.total} câu · {timeAgo(s.created_at)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Bước 2: xem câu nào nhận ra được, chọn cách sinh đề tương tự. */
function SimilarOptions({ sourceId, onBack }: { sourceId: string; onBack: () => void }) {
  const router = useRouter();
  const { data: src } = useSource(sourceId);
  const create = useCreateSimilarExam();
  const [per, setPer] = useState(2);
  const [mode, setMode] = useState<ExamMode>("written");
  const [target, setTarget] = useState<SimilarExamRequest["target"]>("same");

  if (!src || src.status === "processing") {
    const step = src?.steps.find((s) => s.state === "running")?.label;
    return (
      <Card className="flex items-center gap-3 p-6 text-sm text-muted">
        <LoaderCircle className="size-5 animate-spin text-brand-600" aria-hidden /> Đang phân tích đề{step ? `: ${step.toLowerCase()}…` : "…"}
      </Card>
    );
  }
  if (src.status === "failed") {
    return (
      <Card className="space-y-3 p-6">
        <p className="font-medium text-danger-700">Không phân tích được đề</p>
        <p className="text-sm text-muted">{src.error}</p>
        <Button variant="outline" onClick={onBack}>
          Thử đề khác
        </Button>
      </Card>
    );
  }

  const ok = src.items.filter((i) => i.status === "recognized");
  const total = Math.min(60, ok.length * per);
  return (
    <Card className="space-y-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <CardTitle>{src.name}</CardTitle>
          <CardDescription>
            Nhận ra {ok.length}/{src.items.length} câu thuộc dạng sinh được câu tương tự.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Đổi đề khác
        </Button>
      </div>

      <ol className="space-y-2">
        {src.items.map((i) => (
          <li key={i.id} className={cn("flex gap-3 rounded-xl px-3 py-2 text-sm", i.status === "recognized" ? "bg-brand-50/60" : "bg-surface")}>
            {i.status === "recognized" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-600" aria-label="Nhận ra" />
            ) : (
              <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted" aria-label="Chưa hỗ trợ" />
            )}
            <span className="min-w-0 flex-1">
              <span className="font-medium text-ink">Câu {i.index}. </span>
              <MathText text={i.statement} />
              <span className="mt-0.5 block text-xs text-muted">
                {i.status === "recognized" ? i.structure?.kind_label : (i.reason ?? "Dạng này chưa sinh được câu tương tự")}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {ok.length > 0 && (
        <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Mỗi câu sinh thêm</p>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <Chip key={n} size="sm" selected={per === n} onClick={() => setPer(n)}>
                  {n} câu
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Hình thức</p>
            <div className="flex gap-2">
              <Chip size="sm" selected={mode === "written"} onClick={() => setMode("written")}>
                Tự luận
              </Chip>
              <Chip size="sm" selected={mode === "choice"} onClick={() => setMode("choice")}>
                Trắc nghiệm
              </Chip>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Độ khó</p>
            <div className="flex flex-wrap gap-2">
              {TARGETS.map((t) => (
                <Chip key={t.value} size="sm" selected={target === t.value} onClick={() => setTarget(t.value)}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {create.isError && <p className="text-sm text-danger-600">{errorMessage(create.error)}</p>}
      {ok.length > 0 && (
        <Button
          size="lg"
          loading={create.isPending}
          onClick={() =>
            create.mutate({ source_id: src.id, per_question: per, mode, target }, { onSuccess: (exam) => router.push(`/exams/${exam.id}`) })
          }
        >
          <Wand2 className="size-4.5" aria-hidden /> Tạo đề tương tự (~{total} câu)
        </Button>
      )}
    </Card>
  );
}

export function SimilarExamBuilder() {
  const [sourceId, setSourceId] = useState<string | null>(null);
  return sourceId ? <SimilarOptions sourceId={sourceId} onBack={() => setSourceId(null)} /> : <SourceInput onCreated={setSourceId} />;
}
