"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { MathText } from "@/components/math";

// Chờ vài giây giữa hai gợi ý để học sinh đọc kỹ thay vì bấm liên tục tới đáp án.
const COOLDOWN_S = 4;

interface Props {
  hints: string[];
  shown: number;
  onReveal: () => void;
}

export function HintSteps({ hints, shown, onReveal }: Props) {
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (!hints.length) return null;

  function reveal() {
    onReveal();
    setWait(COOLDOWN_S);
  }

  return (
    <div className="space-y-2">
      {hints.slice(0, shown).map((h, i) => (
        <div key={i} className="flex gap-2.5 rounded-xl bg-warning-50 p-3.5 text-sm text-warning-700">
          <Lightbulb className="mt-0.5 size-4.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              Gợi ý {i + 1}/{hints.length}
            </p>
            <MathText text={h} className="mt-0.5 block text-ink" />
          </div>
        </div>
      ))}

      {shown < hints.length && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={reveal}
            disabled={wait > 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
          >
            <Lightbulb className="size-4" aria-hidden />
            {shown === 0 ? "Xem gợi ý" : "Gợi ý tiếp theo"}
            {wait > 0 && <span className="tabular-nums">({wait}s)</span>}
          </button>
          {shown === 0 && <span className="text-xs text-muted">Thử tự làm trước nhé: dùng gợi ý thì điểm kỹ năng tăng ít hơn.</span>}
        </div>
      )}
    </div>
  );
}
