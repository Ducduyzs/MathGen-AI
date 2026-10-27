"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useResetCode } from "../api";

/** Mã lớp cỡ lớn để chiếu lên bảng, kèm nút sao chép và đổi mã (khi mã bị lộ ra ngoài lớp). */
export function JoinCode({ classId, code, size = "lg" }: { classId: string; code: string; size?: "sm" | "lg" }) {
  const reset = useResetCode();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Trình duyệt chặn sao chép. Hãy chọn và sao chép mã thủ công.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "rounded-xl bg-brand-50 font-mono font-bold tracking-[0.25em] text-brand-800 ring-1 ring-brand-200 select-all",
          size === "lg" ? "px-4 py-2 text-2xl" : "px-2.5 py-1 text-sm",
        )}
        aria-label={`Mã lớp ${code.split("").join(" ")}`}
      >
        {code}
      </span>
      <Button variant="outline" size="sm" onClick={copy} aria-label="Sao chép mã lớp">
        {copied ? <Check className="size-4 text-success-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {size === "lg" && (copied ? "Đã chép" : "Sao chép")}
      </Button>
      {size === "lg" && (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} loading={reset.isPending}>
          <RefreshCw className="size-4" aria-hidden /> Đổi mã
        </Button>
      )}
      <Dialog
        open={confirming}
        title="Đổi mã lớp?"
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                reset.mutate(classId, {
                  onSuccess: () => toast.success("Đã đổi mã lớp"),
                  onError: (err) => toast.error(errorMessage(err)),
                });
              }}
            >
              Đổi mã
            </Button>
          </>
        }
      >
        Mã cũ sẽ không dùng được nữa. Học sinh đã trong lớp không bị ảnh hưởng.
      </Dialog>
    </div>
  );
}
