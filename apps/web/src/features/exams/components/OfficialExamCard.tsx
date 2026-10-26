"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, Clock, Info, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { errorMessage } from "@/lib/api/errors";
import { useCreateExam } from "../api";
import { formatScore, THPT_STRUCTURE, THPT_TOPICS } from "../model";

const TOTAL_QUESTIONS = THPT_STRUCTURE.reduce((t, p) => t + p.count, 0);

export function OfficialExamCard() {
  const router = useRouter();
  const create = useCreateExam();

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-linear-to-br from-brand-50 to-white p-5 sm:p-7">
          <Badge className="px-3 py-1">Cấu trúc của Bộ GD&ĐT, áp dụng từ năm 2025</Badge>
          <h2 className="mt-3 text-xl font-bold text-ink">Đề thi tốt nghiệp THPT · Môn Toán</h2>
          <p className="mt-1 flex items-center gap-2 text-muted">
            <Clock className="size-4 text-brand-500" aria-hidden /> {TOTAL_QUESTIONS} câu · 90 phút · thang điểm 10
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-surface text-xs text-muted uppercase">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Phần</th>
                <th className="px-3 py-2.5 font-semibold">Hình thức</th>
                <th className="px-3 py-2.5 text-center font-semibold">Số câu</th>
                <th className="px-3 py-2.5 text-center font-semibold">Điểm/câu</th>
                <th className="px-5 py-2.5 text-right font-semibold">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {THPT_STRUCTURE.map((p) => (
                <tr key={p.part}>
                  <td className="px-5 py-3 font-semibold text-brand-700">{p.part}</td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-ink">{p.label}</span>
                    <span className="block text-xs text-muted">{p.note}</span>
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums">{p.count}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{p.type === "true_false" ? "tối đa 1" : formatScore(p.points)}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatScore(p.count * p.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          Phần II chấm theo số ý đúng trong mỗi câu: 1 ý được 0,1 điểm · 2 ý 0,25 · 3 ý 0,5 · cả 4 ý 1 điểm.
        </p>
      </Card>

      <Card className="p-5 sm:p-7">
        <CardTitle>Nội dung trong đề</CardTitle>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {THPT_TOPICS.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-ink">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden /> {t}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex gap-2 rounded-xl bg-surface p-3 text-xs text-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
          Mỗi lần bắt đầu là một đề mới, số liệu được sinh lại theo dạng bài. Đồng hồ chạy theo giờ máy chủ; hết giờ hệ thống tự nộp bài.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
          {create.isError && <p className="mr-auto text-sm text-danger-600">{errorMessage(create.error)}</p>}
          <Button
            size="lg"
            loading={create.isPending}
            onClick={() =>
              create.mutate({ kind: "official", blueprint: "thpt" }, { onSuccess: (exam) => router.push(`/exams/${exam.id}`) })
            }
          >
            <Play className="size-4" aria-hidden /> Bắt đầu làm bài · 90 phút
          </Button>
        </div>
      </Card>

      <Card className="border-dashed p-5 text-sm text-muted">
        <p className="font-medium text-ink">Sắp có: đề kiểm tra định kỳ lớp 6–11 (Công văn 7991/BGDĐT-GDTrH)</p>
        <p className="mt-1">
          Tỉ lệ giữa các phần do từng Sở hướng dẫn, và phần tự luận trình bày lời giải cần giáo viên chấm. Sẽ bổ sung khi có ma trận, bản đặc tả áp dụng.
        </p>
      </Card>
    </div>
  );
}
