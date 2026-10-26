import { cn } from "@/lib/utils";

/** Thanh tiến độ phiên: mỗi vạch là một câu, xanh lá = đúng, đỏ = sai, xanh dương = câu đang làm. */
export function SessionTrack({ results, size }: { results: boolean[]; size: number }) {
  return (
    <div className="flex items-center gap-3">
      <ol className="flex flex-1 gap-1.5" aria-label={`Đã làm ${results.length}/${size} câu, đúng ${results.filter(Boolean).length}`}>
        {Array.from({ length: size }, (_, i) => {
          const r = results[i];
          return (
            <li
              key={i}
              className={cn(
                "h-2 flex-1 rounded-full transition-colors",
                r === undefined ? (i === results.length ? "bg-brand-300" : "bg-brand-100") : r ? "bg-success-600" : "bg-danger-600",
              )}
            />
          );
        })}
      </ol>
      <span className="text-sm font-medium text-muted tabular-nums">
        {Math.min(results.length + 1, size)}/{size}
      </span>
    </div>
  );
}
