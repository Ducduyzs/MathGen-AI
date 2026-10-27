import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import type { ChildReport, ChildSummary, LinkCode, LinkedParent } from "@/types/api";

export const familyKeys = {
  all: ["family"] as const,
  parents: ["family", "parents"] as const,
  children: ["family", "children"] as const,
  child: (id: string) => ["family", "child", id] as const,
};

const enc = encodeURIComponent;

// ---- Học sinh

export function useMyParents() {
  return useQuery({ queryKey: familyKeys.parents, queryFn: () => apiFetch<LinkedParent[]>("/api/me/parents") });
}

export function useCreateLinkCode() {
  return useMutation({ mutationFn: () => apiFetch<LinkCode>("/api/me/parent-code", { method: "POST" }) });
}

export function useRemoveParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (parentId: string) => apiFetch<void>(`/api/me/parents/${enc(parentId)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: familyKeys.parents }),
  });
}

// ---- Phụ huynh

export function useChildren() {
  return useQuery({ queryKey: familyKeys.children, queryFn: () => apiFetch<ChildSummary[]>("/api/children") });
}

export function useChildReport(id: string) {
  return useQuery({ queryKey: familyKeys.child(id), queryFn: () => apiFetch<ChildReport>(`/api/children/${enc(id)}`) });
}

export function useLinkChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiFetch<ChildSummary>("/api/children/link", { method: "POST", body: { code } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: familyKeys.children }),
  });
}

export function useRemoveChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (childId: string) => apiFetch<void>(`/api/children/${enc(childId)}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: familyKeys.child(id) });
      void queryClient.invalidateQueries({ queryKey: familyKeys.children });
    },
  });
}
