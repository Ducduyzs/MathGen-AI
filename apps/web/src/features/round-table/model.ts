"use client";

import { useEffect, useRef, useState } from "react";
import type { TableRoom } from "@/types/api";

export type SkyId = "stars" | "galaxy" | "sunset" | "day";

export const SKIES: { id: SkyId; label: string }[] = [
  { id: "stars", label: "Đêm sao" },
  { id: "galaxy", label: "Thiên hà" },
  { id: "sunset", label: "Hoàng hôn" },
  { id: "day", label: "Ban ngày" },
];

/** Màu riêng của từng ghế: dùng cho nhân vật 3D, bảng điểm và nhãn tên. */
export const SEAT_COLORS = ["#2e93e6", "#e2557a", "#f0a92e", "#2fb37a"];

const SKY_KEY = "round-table-sky";

/** Bầu trời đã chọn, nhớ trong trình duyệt này. */
export function useSky(): [SkyId, (s: SkyId) => void] {
  const [sky, setSky] = useState<SkyId>("galaxy");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SKY_KEY) as SkyId | null;
      if (saved && SKIES.some((s) => s.id === saved)) setSky(saved);
    } catch {
      // localStorage bị chặn: dùng bầu trời mặc định
    }
  }, []);
  return [
    sky,
    (s) => {
      setSky(s);
      try {
        localStorage.setItem(SKY_KEY, s);
      } catch {
        // như trên
      }
    },
  ];
}

/** Tên ngắn trên nhãn 3D: "Nguyễn Minh An" → "An"; máy giữ nguyên tên. */
export const shortName = (name: string, bot: boolean) => (bot ? name.replace(" (máy)", "") : name.trim().split(/\s+/).pop() ?? name);

/**
 * Số mili giây còn lại tới `deadline` theo đồng hồ server (bù lệch giờ máy học sinh bằng `now` server gửi kèm).
 * Cập nhật 4 lần mỗi giây.
 */
export function useCountdown(room: TableRoom | undefined) {
  const offset = useRef(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (room) offset.current = new Date(room.now).getTime() - Date.now();
  }, [room]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);
  if (!room?.deadline) return 0;
  return Math.max(0, new Date(room.deadline).getTime() - (Date.now() + offset.current));
}

/** Xác suất trúng hố đen ở lần quay kế tiếp. */
export const nextRisk = (chambers: number, spins: number) => 1 / Math.max(1, chambers - spins);
