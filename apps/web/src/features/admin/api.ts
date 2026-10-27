import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import type { AdminCreateUserRequest, AdminUpdateUserRequest, AdminUser, QualityReport, Role, UserPage } from "@/types/api";

export const adminKeys = {
  users: (q: string, role: Role | "", page: number) => ["admin", "users", q, role, page] as const,
  quality: ["admin", "quality"] as const,
};

export function useAdminUsers(q: string, role: Role | "", page: number) {
  const qs = new URLSearchParams({ page: String(page) });
  if (q.trim()) qs.set("q", q.trim());
  if (role) qs.set("role", role);
  return useQuery({
    queryKey: adminKeys.users(q.trim(), role, page),
    queryFn: () => apiFetch<UserPage>(`/api/admin/users?${qs}`),
    placeholderData: keepPreviousData,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
}

export function useCreateUser() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: AdminCreateUserRequest) => apiFetch<AdminUser>("/api/admin/users", { method: "POST", body }), onSuccess: refresh });
}

export function useUpdateUser() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, ...body }: AdminUpdateUserRequest & { id: string }) =>
      apiFetch<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body }),
    onSuccess: refresh,
  });
}

export function useSetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiFetch<void>(`/api/admin/users/${encodeURIComponent(id)}/password`, { method: "POST", body: { password } }),
  });
}

export function useQuality() {
  return useQuery({ queryKey: adminKeys.quality, queryFn: () => apiFetch<QualityReport>("/api/admin/quality") });
}
