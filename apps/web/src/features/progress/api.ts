import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import type { AttemptSummary, Progress } from "@/types/api";

export const progressKeys = {
  all: ["me"] as const,
  progress: ["me", "progress"] as const,
  attempts: ["me", "attempts"] as const,
};

export function useProgress() {
  return useQuery({
    queryKey: progressKeys.progress,
    queryFn: () => apiFetch<Progress>("/api/me/progress"),
  });
}

export function useRecentAttempts() {
  return useQuery({
    queryKey: progressKeys.attempts,
    queryFn: () => apiFetch<AttemptSummary[]>("/api/me/attempts?limit=10"),
  });
}
