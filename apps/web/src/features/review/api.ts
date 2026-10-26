import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/http";
import type { ReviewDecision, ReviewItem } from "@/types/api";

export const reviewKeys = {
  queue: ["review", "queue"] as const,
};

export function useReviewQueue() {
  return useQuery({
    queryKey: reviewKeys.queue,
    queryFn: () => apiFetch<ReviewItem[]>("/api/review/queue"),
    staleTime: 0,
  });
}

/** Optimistic: bài biến khỏi hàng chờ ngay, API lỗi thì hoàn tác. */
export function useReviewDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReviewDecision }) =>
      apiFetch<void>(`/api/review/${encodeURIComponent(id)}`, { method: "POST", body }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: reviewKeys.queue });
      const previous = queryClient.getQueryData<ReviewItem[]>(reviewKeys.queue);
      queryClient.setQueryData<ReviewItem[]>(reviewKeys.queue, (old) => old?.filter((item) => item.id !== id));
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(reviewKeys.queue, ctx.previous);
      toast.error(errorMessage(err));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reviewKeys.queue }),
  });
}
