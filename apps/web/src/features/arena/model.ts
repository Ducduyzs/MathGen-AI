import type { ArenaDuration, ArenaPool } from "@/types/api";

export const ARENA_DURATIONS: ArenaDuration[] = [5, 15, 30];

export const POOLS: { pool: ArenaPool; title: string; text: string }[] = [
  { pool: "basic", title: "Đại số 8–10", text: "Phương trình, bất phương trình, phân tích đa thức, hàm số bậc hai." },
  { pool: "thpt", title: "Ôn thi THPT", text: "Đạo hàm, tích phân, mũ – logarit, hình không gian, Oxyz, xác suất." },
];

export const POOL_LABEL: Record<ArenaPool, string> = { basic: "Đại số 8–10", thpt: "Ôn thi THPT" };

/** Lớp 11–12 mặc định chọn kho ôn thi THPT. */
export const defaultPool = (grade: number | null | undefined): ArenaPool => (grade && grade >= 11 ? "thpt" : "basic");

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
