import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { progressKeys } from "@/features/progress";
import { ApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/http";
import type { CreateExamRequest, Exam, ExamSummary, Skill, SubmitExamRequest } from "@/types/api";

export const examKeys = {
  all: ["exams"] as const,
  list: ["exams", "list"] as const,
  detail: (id: string) => ["exams", "detail", id] as const,
  skills: ["skills"] as const,
};

export function useSkills() {
  return useQuery({
    queryKey: examKeys.skills,
    queryFn: () => apiFetch<Skill[]>("/api/skills"),
    staleTime: Infinity,
  });
}

export function useRecentExams() {
  return useQuery({
    queryKey: examKeys.list,
    queryFn: () => apiFetch<ExamSummary[]>("/api/exams"),
  });
}

export function useExam(id: string) {
  return useQuery({
    queryKey: examKeys.detail(id),
    queryFn: () => apiFetch<Exam>(`/api/exams/${encodeURIComponent(id)}`),
    staleTime: Infinity,
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExamRequest) => apiFetch<Exam>("/api/exams", { method: "POST", body }),
    onSuccess: (exam) => {
      queryClient.setQueryData(examKeys.detail(exam.id), exam);
      void queryClient.invalidateQueries({ queryKey: examKeys.list });
    },
  });
}

export function useSubmitExam(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitExamRequest) =>
      apiFetch<Exam>(`/api/exams/${encodeURIComponent(id)}/submit`, { method: "POST", body }),
    // Nộp lại đề đã chấm chỉ trả kết quả cũ, nên thử lại khi mất mạng là an toàn.
    retry: (count, err) => err instanceof ApiError && err.status === 0 && count < 3,
    onSuccess: (exam) => {
      queryClient.setQueryData(examKeys.detail(id), exam);
      void queryClient.invalidateQueries({ queryKey: examKeys.list });
      void queryClient.invalidateQueries({ queryKey: progressKeys.all });
      // Bài giao của lớp: trạng thái và báo cáo đổi sau khi nộp (khóa của features/classroom, viết thẳng để tránh import vòng)
      if (exam.assignment_id) void queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}
