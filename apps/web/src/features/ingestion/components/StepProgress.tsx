import { Check, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IngestionStep } from "@/types/api";

/** Thanh tiến trình 5 bước của pipeline: Tải lên → Trích xuất → Tách câu → Nhận dạng → Kiểm chứng. */
export function StepProgress({ steps }: { steps: IngestionStep[] }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Tiến trình xử lý">
      {steps.map((s) => (
        <li key={s.key} className="min-w-0">
          <div
            className={cn(
              "h-1.5 rounded-full transition-colors",
              s.state === "done" ? "bg-brand-500" : s.state === "running" ? "animate-pulse bg-brand-300" : s.state === "failed" ? "bg-danger-600" : "bg-line",
            )}
          />
          <p
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium sm:text-sm",
              s.state === "pending" ? "text-muted" : s.state === "failed" ? "text-danger-700" : "text-ink",
            )}
          >
            {s.state === "done" && <Check className="size-3.5 shrink-0 text-brand-600" aria-hidden />}
            {s.state === "running" && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-brand-500" aria-hidden />}
            {s.state === "failed" && <X className="size-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{s.label}</span>
            <span className="sr-only">
              {s.state === "done" ? " (xong)" : s.state === "running" ? " (đang chạy)" : s.state === "failed" ? " (lỗi)" : ""}
            </span>
          </p>
        </li>
      ))}
    </ol>
  );
}
