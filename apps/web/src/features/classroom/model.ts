import type { Assignment, AssignmentReport, AssignmentStatus } from "@/types/api";
import { formatScore } from "@/features/exams/model";

export const STATUS: Record<AssignmentStatus, { label: string; tone: "brand" | "neutral" | "success" | "warning" | "danger" }> = {
  todo: { label: "Chưa làm", tone: "brand" },
  in_progress: { label: "Đang làm", tone: "warning" },
  submitted: { label: "Đã nộp", tone: "success" },
  late: { label: "Nộp muộn", tone: "warning" },
  missed: { label: "Quá hạn", tone: "danger" },
};

export const isOpen = (s: AssignmentStatus | undefined) => s === "todo" || s === "in_progress";

export { GRADES } from "@/lib/grades";

const dateTime = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}

/** "còn 2 ngày", "còn 3 giờ", "còn 25 phút", "đã hết hạn". */
export function dueLabel(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "đã hết hạn";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `còn ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `còn ${hours} giờ`;
  return `còn ${Math.floor(hours / 24)} ngày`;
}

/** Sắp hết hạn (dưới 24 giờ): tô màu cảnh báo. */
export function dueSoon(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  return ms > 0 && ms < 24 * 3600_000;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} phút ${String(s).padStart(2, "0")} giây` : `${s} giây`;
}

export function assignmentMeta(a: Assignment) {
  const parts = [a.kind === "official" ? "Đề thi THPT" : a.mode === "choice" ? "Trắc nghiệm" : "Tự luận", `${a.size} câu`];
  parts.push(a.duration_minutes ? `${a.duration_minutes} phút` : "Không giới hạn thời gian");
  if (a.shuffle) parts.push("Đảo câu");
  return parts.join(" · ");
}

export const BUCKETS = ["0–2", "2–4", "4–6", "6–8", "8–10"];

/** Bảng điểm dạng CSV (mở được bằng Excel: thêm BOM để hiện đúng tiếng Việt). */
export function reportCsv(r: AssignmentReport) {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: (string | number | null)[][] = [
    ["STT", "Họ và tên", "Trạng thái", "Điểm", "Số câu đúng", "Tổng số câu", "Nộp lúc", "Thời gian làm (phút)"],
    ...r.students.map((s, i) => [
      i + 1,
      s.full_name,
      STATUS[s.status].label,
      s.score === null ? null : formatScore(s.score),
      s.correct,
      s.total,
      s.submitted_at ? formatDateTime(s.submitted_at) : null,
      s.duration_seconds === null ? null : Math.round(s.duration_seconds / 60),
    ]),
  ];
  return "﻿" + rows.map((row) => row.map(esc).join(",")).join("\r\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
