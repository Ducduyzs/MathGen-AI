import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { progressKeys } from "@/features/progress";
import { ApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/http";
import type { AttemptRequest, AttemptResult, PublicProblem } from "@/types/api";

export const practiceKeys = {
  next: (skill: string | null, round: number, similarTo?: string) =>
    ["practice", "next", skill ?? "auto", round, similarTo ?? null] as const,
};

/**
 * Mỗi `round` là một bài; prefetch round + 1 để bấm "Bài tiếp" hiện ngay.
 * `similarTo`: lấy bài cùng dạng với bài vừa làm sai.
 */
export function nextProblemOptions(skill: string | null, round: number, similarTo?: string) {
  const qs = new URLSearchParams();
  if (skill) qs.set("skill", skill);
  if (similarTo) qs.set("similar_to", similarTo);
  const suffix = qs.toString() ? `?${qs}` : "";
  return queryOptions({
    queryKey: practiceKeys.next(skill, round, similarTo),
    queryFn: () => apiFetch<PublicProblem>(`/api/practice/next${suffix}`),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: AttemptRequest) =>
      apiFetch<AttemptResult>("/api/attempts", {
        method: "POST",
        body: req,
        headers: { "Idempotency-Key": req.client_attempt_id },
      }),
    // An toàn để thử lại nhờ Idempotency-Key: backend không tạo bản ghi trùng.
    retry: (count, err) => err instanceof ApiError && err.status === 0 && count < 3,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: progressKeys.all }),
  });
}
