import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/http";
import type { ProvinceStats, SchoolInfo } from "@/types/api";

export const regionKeys = {
  provinces: ["regions"] as const,
  schools: (province: string) => ["regions", province, "schools"] as const,
};

/** 34 tỉnh/thành kèm số câu đề thật và số trường đã thu thập. */
export function useProvinces() {
  return useQuery({ queryKey: regionKeys.provinces, queryFn: () => apiFetch<ProvinceStats[]>("/api/regions"), staleTime: 5 * 60_000 });
}

export function useSchools(province: string | null) {
  return useQuery({
    queryKey: regionKeys.schools(province ?? ""),
    queryFn: () => apiFetch<SchoolInfo[]>(`/api/regions/${encodeURIComponent(province!)}/schools`),
    enabled: !!province,
    staleTime: 5 * 60_000,
  });
}
