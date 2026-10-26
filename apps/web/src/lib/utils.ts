import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function percent(x: number) {
  return `${Math.round(x * 100)}%`;
}

/** 4 mức độ nhận thức theo cách ra đề của Bộ GD&ĐT; tham số `level` 1–4 dùng cho bộ lọc. */
export const DIFFICULTY_LEVELS = [
  { level: 1, max: 0.25, label: "Nhận biết", tone: "success" },
  { level: 2, max: 0.5, label: "Thông hiểu", tone: "brand" },
  { level: 3, max: 0.75, label: "Vận dụng", tone: "warning" },
  { level: 4, max: Infinity, label: "Vận dụng cao", tone: "danger" },
] as const;

export function difficultyLevel(d: number) {
  return DIFFICULTY_LEVELS.find((l) => d < l.max) ?? DIFFICULTY_LEVELS[3];
}

/** Mức thành thạo kỹ năng, hiển thị bằng chữ thay vì chỉ có phần trăm. */
export function masteryLevel(score: number) {
  if (score < 0.4) return { label: "Mới bắt đầu", tone: "neutral" } as const;
  if (score < 0.6) return { label: "Đang luyện", tone: "warning" } as const;
  if (score < 0.85) return { label: "Thành thạo", tone: "brand" } as const;
  return { label: "Vững vàng", tone: "success" } as const;
}

/** Bỏ ký hiệu LaTeX để dùng cho <title>, mô tả SEO. */
export function plainText(text: string) {
  return text
    .replace(/\$+/g, "")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Người dùng đang gõ trong ô nhập thì bỏ qua phím tắt. */
export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}

const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return "vừa xong";
}
