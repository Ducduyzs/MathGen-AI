"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Rewards } from "@/types/api";
import { useRewards } from "../api";

/**
 * Chúc mừng khi vừa đạt mục tiêu ngày, xong nhiệm vụ, nhận huy hiệu hay lượt đóng băng.
 * So dữ liệu mới với lần trước (mọi hoạt động đều làm mới ["me"]) nên luyện tập, đề và Đấu trường dùng chung một chỗ.
 */
export function RewardWatcher() {
  const { data } = useRewards();
  const prev = useRef<Rewards | null>(null);

  useEffect(() => {
    if (!data) return;
    const before = prev.current;
    prev.current = data;
    if (!before || before.today !== data.today) return; // lần tải đầu hoặc sang ngày mới: không báo lại

    if (before.today_attempts < before.daily_goal && data.today_attempts >= data.daily_goal) {
      toast.success("Đạt mục tiêu hôm nay!", { description: `Chuỗi ${data.streak_days} ngày học liên tiếp.` });
    }
    const doneBefore = new Set(before.quests.filter((q) => q.done).map((q) => q.code));
    for (const q of data.quests) {
      if (q.done && !doneBefore.has(q.code)) toast.success(`Hoàn thành nhiệm vụ: ${q.title}`, { description: `+${q.reward} XP` });
    }
    const had = new Set(before.badges.filter((b) => b.earned_at).map((b) => b.code));
    for (const b of data.badges) {
      if (b.earned_at && !had.has(b.code)) toast.success(`Huy hiệu mới: ${b.title}`, { description: b.description });
    }
    if (data.freezes > before.freezes) {
      toast.success("Nhận thêm 1 lượt đóng băng chuỗi", { description: "Nghỉ một ngày chuỗi vẫn được giữ." });
    }
  }, [data]);

  return null;
}
