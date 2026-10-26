import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { percent } from "@/lib/utils";

interface Props {
  results: boolean[];
  times: number[];
  hintsUsed: number;
  onRestart: () => void;
}

export function SessionSummary({ results, times, hintsUsed, onRestart }: Props) {
  const correct = results.filter(Boolean).length;
  const accuracy = results.length ? correct / results.length : 0;
  const avgSeconds = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000) : 0;
  const message =
    accuracy >= 0.8 ? "Xuất sắc! Bạn đã sẵn sàng cho bài khó hơn." : accuracy >= 0.5 ? "Làm tốt lắm, tiếp tục giữ nhịp nhé." : "Đừng nản, xem lại lời giải rồi luyện tiếp nhé.";

  return (
    <Card className="overflow-hidden">
      <div className="bg-linear-to-br from-brand-50 to-brand-100 px-6 py-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
          <Trophy className="size-7" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">Hoàn thành phiên luyện tập</h2>
        <p className="mt-1 text-muted">{message}</p>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-line border-y border-line text-center">
        <div className="px-3 py-4">
          <dt className="text-xs text-muted">Câu đúng</dt>
          <dd className="mt-1 text-xl font-bold text-ink tabular-nums">
            {correct}/{results.length}
          </dd>
        </div>
        <div className="px-3 py-4">
          <dt className="text-xs text-muted">Tỷ lệ đúng</dt>
          <dd className="mt-1 text-xl font-bold text-ink tabular-nums">{percent(accuracy)}</dd>
        </div>
        <div className="px-3 py-4">
          <dt className="text-xs text-muted">TB mỗi câu</dt>
          <dd className="mt-1 text-xl font-bold text-ink tabular-nums">{avgSeconds}s</dd>
        </div>
      </dl>
      <div className="flex flex-col items-center gap-3 p-6 sm:flex-row sm:justify-center">
        {hintsUsed > 0 && <p className="text-sm text-muted sm:mr-auto">Đã dùng {hintsUsed} gợi ý trong phiên.</p>}
        <Link href="/me/progress" className={buttonClasses({ variant: "outline" })}>
          Xem tiến độ
        </Link>
        <Button onClick={onRestart} autoFocus>
          Luyện phiên mới
        </Button>
      </div>
    </Card>
  );
}
