"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, FileUp, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB, useCreateSource } from "../api";
import { SAMPLE_EXAM } from "../sample";

type Tab = "file" | "text";

function checkFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return "Định dạng file chưa được hỗ trợ. Dùng PDF, Word (.docx), ảnh hoặc file văn bản.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `File vượt quá ${MAX_UPLOAD_MB} MB.`;
  return null;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadForm() {
  const router = useRouter();
  const create = useCreateSource();
  const input = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    const problem = checkFile(f);
    setError(problem);
    setFile(problem ? null : f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  }

  const ready = tab === "file" ? !!file : text.trim().length > 0;

  function submit() {
    if (!ready) return;
    create.mutate(
      tab === "file" ? { name: name.trim() || file!.name, file: file! } : { name: name.trim() || "Nội dung dán vào", text },
      { onSuccess: (src) => router.push(`/teacher/uploads/${src.id}`) },
    );
  }

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div role="tablist" aria-label="Cách nhập đề" className="inline-flex rounded-xl bg-surface p-1">
        {([
          ["file", FileUp, "Tải file"],
          ["text", ClipboardPaste, "Dán nội dung"],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              setError(null);
            }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
              "focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none",
              tab === key ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-brand-500 bg-brand-50" : "border-line bg-surface/50",
            )}
          >
            <span className="grid size-12 place-items-center rounded-xl bg-brand-100 text-brand-600">
              <FileUp className="size-6" aria-hidden />
            </span>
            <p className="mt-3 font-medium text-ink">Kéo thả file đề vào đây</p>
            <p className="mt-1 text-sm text-muted">PDF, Word (.docx), ảnh chụp đề hoặc file văn bản · tối đa {MAX_UPLOAD_MB} MB</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => input.current?.click()}>
              Chọn file
            </Button>
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {file && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-line px-4 py-3">
              <FileUp className="size-5 shrink-0 text-brand-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{file.name}</p>
                <p className="text-xs text-muted">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink"
                aria-label="Bỏ file"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label htmlFor="exam-text" className="mb-0">
              Nội dung đề
            </Label>
            <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE_EXAM)}>
              <Sparkles className="size-4" aria-hidden /> Dùng đề mẫu
            </Button>
          </div>
          <Textarea
            id="exam-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-64 font-mono text-sm"
            placeholder={"Câu 1. Giải phương trình 2x + 3 = 7.\nCâu 2. ..."}
          />
          <p className="mt-1.5 text-sm text-muted">Dán nguyên văn từ Word hoặc PDF. Mỗi câu bắt đầu bằng &quot;Câu 1.&quot;, &quot;Bài 1:&quot; hoặc &quot;1.&quot;.</p>
        </div>
      )}

      <div>
        <Label htmlFor="source-name">Tên tài liệu (không bắt buộc)</Label>
        <Input
          id="source-name"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          placeholder={tab === "file" ? (file?.name ?? "Ví dụ: Đề kiểm tra 45 phút lớp 9") : "Ví dụ: Đề kiểm tra 45 phút lớp 9"}
        />
      </div>

      <FieldError message={error ?? (create.isError ? errorMessage(create.error) : undefined)} />

      <div className="flex justify-end border-t border-line pt-5">
        <Button size="lg" onClick={submit} disabled={!ready} loading={create.isPending}>
          Phân tích đề
        </Button>
      </div>
    </Card>
  );
}

export function UploadIntro() {
  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>Hệ thống làm gì với đề của bạn</CardTitle>
      <ol className="mt-3 space-y-3 text-sm">
        {[
          ["Trích xuất và tách câu", "Đọc file, tách từng câu hỏi, giữ nguyên phương án A/B/C/D nếu có."],
          ["Nhận dạng dạng bài", "Đưa đề về dạng có cấu trúc, ví dụ ax² + bx + c = 0 với a, b, c cụ thể."],
          ["Giải và kiểm chứng", "Giải bằng số học chính xác, thử lại nghiệm, phát hiện câu trùng với ngân hàng."],
          ["Sinh biến thể", "Đổi hệ số theo luật có kiểm soát; mỗi biến thể được giải lại và kiểm tra trước khi vào hàng chờ duyệt."],
        ].map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{i + 1}</span>
            <span>
              <span className="font-medium text-ink">{title}.</span> <span className="text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
