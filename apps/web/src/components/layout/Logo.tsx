import { Sigma } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold text-ink", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-200">
        <Sigma className="size-5" aria-hidden />
      </span>
      <span className="text-lg tracking-tight">
        MathGen<span className="text-brand-600"> AI</span>
      </span>
    </span>
  );
}
