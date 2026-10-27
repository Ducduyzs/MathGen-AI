// Chỉ gọi từ Server Component (trang công khai).
import { serverFetch } from "@/lib/api/server";
import type { Paginated, PublicProblem, Skill } from "@/types/api";

export interface ProblemQuery {
  grade?: string;
  skill?: string;
  /** 1–4: Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao. */
  level?: string;
  q?: string;
  /** Mã tỉnh: chỉ bài từ đề thật của tỉnh đó. */
  province?: string;
}

export function getProblems(query: ProblemQuery) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) qs.set(key, value);
  const suffix = qs.toString() ? `?${qs}` : "";
  return serverFetch<Paginated<PublicProblem>>(`/api/problems${suffix}`, 300);
}

export function getProblem(id: string) {
  return serverFetch<PublicProblem>(`/api/problems/${encodeURIComponent(id)}`);
}

export function getSkills() {
  return serverFetch<Skill[]>("/api/skills");
}
