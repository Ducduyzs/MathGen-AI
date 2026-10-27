import { useQuery } from "@tanstack/react-query";
import { progressKeys } from "@/features/progress";
import { apiFetch } from "@/lib/api/http";
import type { Rewards } from "@/types/api";

// Nằm dưới ["me"]: luyện tập, nộp đề, Đấu trường đều làm mới ["me"] nên XP và nhiệm vụ tự cập nhật.
export const rewardsKeys = {
  summary: [...progressKeys.all, "rewards"] as const,
};

export function useRewards(enabled = true) {
  return useQuery({
    queryKey: rewardsKeys.summary,
    queryFn: () => apiFetch<Rewards>("/api/me/rewards"),
    enabled,
  });
}
