import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { progressKeys } from "@/features/progress";
import { apiFetch } from "@/lib/api/http";
import type { ArenaAnswerResult, ArenaBoard, ArenaDuration, ArenaMe, ArenaPool, ArenaRankBoard, ArenaRun, ExamAnswer } from "@/types/api";

export const arenaKeys = {
  all: ["arena"] as const,
  me: ["arena", "me"] as const,
  board: (pool: ArenaPool, duration: ArenaDuration, scope: "week" | "all") => ["arena", "board", pool, duration, scope] as const,
  run: (id: string) => ["arena", "run", id] as const,
  ranking: ["arena", "ranking"] as const,
};

const enc = encodeURIComponent;

export function useArenaMe() {
  return useQuery({ queryKey: arenaKeys.me, queryFn: () => apiFetch<ArenaMe>("/api/arena/me") });
}

export function useArenaBoard(pool: ArenaPool, duration: ArenaDuration, scope: "week" | "all") {
  return useQuery({
    queryKey: arenaKeys.board(pool, duration, scope),
    queryFn: () => apiFetch<ArenaBoard>(`/api/arena/leaderboard?pool=${pool}&duration=${duration}&scope=${scope}`),
  });
}

export function useRankBoard() {
  return useQuery({ queryKey: arenaKeys.ranking, queryFn: () => apiFetch<ArenaRankBoard>("/api/arena/ranking") });
}

export function useArenaRun(id: string) {
  return useQuery({ queryKey: arenaKeys.run(id), queryFn: () => apiFetch<ArenaRun>(`/api/arena/runs/${enc(id)}`), staleTime: Infinity });
}

export function useStartRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { pool: ArenaPool; duration_minutes: ArenaDuration }) => apiFetch<ArenaRun>("/api/arena/runs", { method: "POST", body }),
    onSuccess: (run) => queryClient.setQueryData(arenaKeys.run(run.id), run),
  });
}

/** Kết thúc lượt: điểm, hạng và tiến độ học đều đổi. */
function useRunDone() {
  const queryClient = useQueryClient();
  return (run: ArenaRun) => {
    queryClient.setQueryData(arenaKeys.run(run.id), run);
    if (run.finished) {
      void queryClient.invalidateQueries({ queryKey: arenaKeys.me });
      void queryClient.invalidateQueries({ queryKey: ["arena", "board"] });
      void queryClient.invalidateQueries({ queryKey: arenaKeys.ranking });
      void queryClient.invalidateQueries({ queryKey: progressKeys.all });
    }
  };
}

export function useAnswer(runId: string) {
  const done = useRunDone();
  return useMutation({
    mutationFn: (body: { key: string; answer: ExamAnswer | null }) =>
      apiFetch<ArenaAnswerResult>(`/api/arena/runs/${enc(runId)}/answer`, { method: "POST", body }),
    onSuccess: (r) => done(r.run),
  });
}

export function useFinishRun(runId: string) {
  const done = useRunDone();
  return useMutation({
    mutationFn: () => apiFetch<ArenaRun>(`/api/arena/runs/${enc(runId)}/finish`, { method: "POST" }),
    onSuccess: done,
  });
}
