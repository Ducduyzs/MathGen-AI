import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { progressKeys } from "@/features/progress";
import { apiFetch } from "@/lib/api/http";
import type { ArenaPool, ExamAnswer, TableRoom } from "@/types/api";

export const tableKeys = {
  room: (code: string) => ["round-table", code] as const,
};

const enc = encodeURIComponent;

/** Phòng đang chơi: hỏi lại mỗi giây (server tự đẩy ván tới đúng thời điểm khi được hỏi). */
export function useRoom(code: string) {
  return useQuery({
    queryKey: tableKeys.room(code),
    queryFn: () => apiFetch<TableRoom>(`/api/round-table/rooms/${enc(code)}`),
    refetchInterval: (q) => (q.state.data?.phase === "finished" ? false : 1000),
    refetchIntervalInBackground: false,
  });
}

function useRoomMutation<TVars>(fn: (vars: TVars) => Promise<TableRoom>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (room) => {
      queryClient.setQueryData(tableKeys.room(room.code), room);
      if (room.phase === "finished") void queryClient.invalidateQueries({ queryKey: progressKeys.all });
    },
  });
}

export function useCreateRoom() {
  return useRoomMutation((body: { pool: ArenaPool; rounds: number }) => apiFetch<TableRoom>("/api/round-table/rooms", { method: "POST", body }));
}

export function useJoinRoom() {
  return useRoomMutation((code: string) => apiFetch<TableRoom>(`/api/round-table/rooms/${enc(code.trim().toUpperCase())}/join`, { method: "POST" }));
}

export function useStartRoom(code: string) {
  return useRoomMutation(() => apiFetch<TableRoom>(`/api/round-table/rooms/${enc(code)}/start`, { method: "POST" }));
}

export function useAnswerRoom(code: string) {
  return useRoomMutation((body: { round: number; answer: ExamAnswer | null }) =>
    apiFetch<TableRoom>(`/api/round-table/rooms/${enc(code)}/answer`, { method: "POST", body }),
  );
}

export function useLeaveRoom(code: string) {
  return useMutation({ mutationFn: () => apiFetch<void>(`/api/round-table/rooms/${enc(code)}/leave`, { method: "POST" }) });
}
