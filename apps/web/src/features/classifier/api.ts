import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import type { ClassifierPrediction, ClassifierStatus } from "@/types/api";

export function useClassifierStatus() {
  return useQuery({ queryKey: ["classifier", "status"], queryFn: () => apiFetch<ClassifierStatus>("/api/classifier/status"), staleTime: 60_000 });
}

export function usePredict() {
  return useMutation({
    mutationFn: (texts: string[]) => apiFetch<ClassifierPrediction[]>("/api/classifier/predict", { method: "POST", body: { texts } }),
  });
}
