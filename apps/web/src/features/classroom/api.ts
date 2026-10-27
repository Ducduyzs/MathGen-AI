import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import type {
  Assignment,
  AssignmentReport,
  ClassDetail,
  ClassRoom,
  CreateAssignmentRequest,
  CreateClassRequest,
  Exam,
  LeaderboardRow,
} from "@/types/api";

export const classKeys = {
  all: ["classes"] as const,
  list: ["classes", "list"] as const,
  detail: (id: string) => ["classes", "detail", id] as const,
  assignments: (id: string) => ["classes", "assignments", id] as const,
  leaderboard: (id: string) => ["classes", "leaderboard", id] as const,
  mine: ["classes", "my-assignments"] as const,
  report: (id: string) => ["classes", "report", id] as const,
  submission: (assignmentId: string, studentId: string) => ["classes", "submission", assignmentId, studentId] as const,
};

const enc = encodeURIComponent;

export function useClasses(enabled = true) {
  return useQuery({ queryKey: classKeys.list, queryFn: () => apiFetch<ClassRoom[]>("/api/classes"), enabled });
}

export function useClass(id: string) {
  return useQuery({ queryKey: classKeys.detail(id), queryFn: () => apiFetch<ClassDetail>(`/api/classes/${enc(id)}`) });
}

export function useClassAssignments(id: string) {
  return useQuery({ queryKey: classKeys.assignments(id), queryFn: () => apiFetch<Assignment[]>(`/api/classes/${enc(id)}/assignments`) });
}

export function useLeaderboard(id: string) {
  return useQuery({ queryKey: classKeys.leaderboard(id), queryFn: () => apiFetch<LeaderboardRow[]>(`/api/classes/${enc(id)}/leaderboard`) });
}

export function useMyAssignments(enabled = true) {
  return useQuery({ queryKey: classKeys.mine, queryFn: () => apiFetch<Assignment[]>("/api/me/assignments"), enabled });
}

export function useAssignmentReport(id: string) {
  return useQuery({
    queryKey: classKeys.report(id),
    queryFn: () => apiFetch<AssignmentReport>(`/api/assignments/${enc(id)}/report`),
    // Giáo viên thường mở báo cáo trong lúc học sinh đang làm: tự cập nhật mỗi 30 giây
    refetchInterval: 30_000,
  });
}

export function useSubmission(assignmentId: string, studentId: string) {
  return useQuery({
    queryKey: classKeys.submission(assignmentId, studentId),
    queryFn: () => apiFetch<Exam>(`/api/assignments/${enc(assignmentId)}/submissions/${enc(studentId)}`),
    staleTime: Infinity,
  });
}

/** Mọi thao tác ghi đều làm mới toàn bộ dữ liệu lớp: số liệu nhỏ, đơn giản hơn cập nhật từng khóa. */
function useClassMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classKeys.all }),
  });
}

export const useCreateClass = () =>
  useClassMutation((body: CreateClassRequest) => apiFetch<ClassRoom>("/api/classes", { method: "POST", body }));

export const useJoinClass = () =>
  useClassMutation((code: string) => apiFetch<ClassRoom>("/api/classes/join", { method: "POST", body: { code } }));

export const useResetCode = () =>
  useClassMutation((id: string) => apiFetch<ClassDetail>(`/api/classes/${enc(id)}/code`, { method: "POST" }));

export const useDeleteClass = () => useClassMutation((id: string) => apiFetch<void>(`/api/classes/${enc(id)}`, { method: "DELETE" }));

export const useRemoveMember = () =>
  useClassMutation(({ classId, userId }: { classId: string; userId: string }) =>
    apiFetch<void>(`/api/classes/${enc(classId)}/members/${enc(userId)}`, { method: "DELETE" }),
  );

export const useCreateAssignment = () =>
  useClassMutation(({ classId, body }: { classId: string; body: CreateAssignmentRequest }) =>
    apiFetch<Assignment>(`/api/classes/${enc(classId)}/assignments`, { method: "POST", body }),
  );

export const useDeleteAssignment = () =>
  useClassMutation((id: string) => apiFetch<void>(`/api/assignments/${enc(id)}`, { method: "DELETE" }));

export const useStartAssignment = () =>
  useClassMutation((id: string) => apiFetch<{ exam_id: string }>(`/api/assignments/${enc(id)}/start`, { method: "POST" }));
