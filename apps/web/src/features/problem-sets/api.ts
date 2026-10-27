import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import type { ProblemSet, ProblemSetSummary, TemplateCount, TemplateInfo, UpdateProblemSetRequest } from "@/types/api";

export const setKeys = {
  all: ["problem-sets"] as const,
  list: ["problem-sets", "list"] as const,
  detail: (id: string) => ["problem-sets", "detail", id] as const,
  templates: ["exam-templates"] as const,
};

const enc = encodeURIComponent;

export function useProblemSets() {
  return useQuery({ queryKey: setKeys.list, queryFn: () => apiFetch<ProblemSetSummary[]>("/api/problem-sets") });
}

export function useProblemSet(id: string) {
  return useQuery({ queryKey: setKeys.detail(id), queryFn: () => apiFetch<ProblemSet>(`/api/problem-sets/${enc(id)}`) });
}

export function useTemplates() {
  return useQuery({ queryKey: setKeys.templates, queryFn: () => apiFetch<TemplateInfo[]>("/api/exams/templates"), staleTime: Infinity });
}

/** Thao tác trên một bộ đề: server trả bộ đề mới, ghi thẳng vào cache rồi làm mới danh sách. */
function useSetMutation<TVars>(id: string, fn: (vars: TVars) => Promise<ProblemSet>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (set) => {
      queryClient.setQueryData(setKeys.detail(id), set);
      void queryClient.invalidateQueries({ queryKey: setKeys.list });
    },
  });
}

export const useUpdateSet = (id: string) =>
  useSetMutation(id, (body: UpdateProblemSetRequest) => apiFetch<ProblemSet>(`/api/problem-sets/${enc(id)}`, { method: "PATCH", body }));

export const useAddQuestions = (id: string) =>
  useSetMutation(id, (items: TemplateCount[]) =>
    apiFetch<ProblemSet>(`/api/problem-sets/${enc(id)}/questions`, { method: "POST", body: { items } }),
  );

export const useRegenerate = (id: string) =>
  useSetMutation(id, (key: string) =>
    apiFetch<ProblemSet>(`/api/problem-sets/${enc(id)}/questions/${enc(key)}/regenerate`, { method: "POST" }),
  );

export function useCreateSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; items?: TemplateCount[] }) =>
      apiFetch<ProblemSet>("/api/problem-sets", { method: "POST", body }),
    onSuccess: (set) => {
      queryClient.setQueryData(setKeys.detail(set.id), set);
      void queryClient.invalidateQueries({ queryKey: setKeys.list });
    },
  });
}

export function useDuplicateSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<ProblemSetSummary>(`/api/problem-sets/${enc(id)}/duplicate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: setKeys.list }),
  });
}

export function useDeleteSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/problem-sets/${enc(id)}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: setKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: setKeys.list });
    },
  });
}
