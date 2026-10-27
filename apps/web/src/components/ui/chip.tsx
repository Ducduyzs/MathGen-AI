import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Nút chọn dạng viên thuốc (một hoặc nhiều lựa chọn). */
export function Chip({ selected, onClick, children, size = "md" }: { selected: boolean; onClick: () => void; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
        "focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        selected ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50",
      )}
    >
      {selected && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}
