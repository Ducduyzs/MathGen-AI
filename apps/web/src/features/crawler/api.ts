import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewKeys } from "@/features/review";
import { apiFetch } from "@/lib/api/http";
import type { CrawlJob, CrawlJobSummary, CrawlSource, CreateCrawlSourceRequest, RobotsCheck } from "@/types/api";

export const crawlerKeys = {
  sources: ["crawler", "sources"] as const,
  jobs: (sourceId: string) => ["crawler", "jobs", sourceId] as const,
  job: (id: string) => ["crawler", "job", id] as const,
};

const enc = encodeURIComponent;
const busy = (s?: string) => s === "queued" || s === "running";

/** Danh sách nguồn; khi có lượt đang chạy thì hỏi lại để cập nhật số trang. */
export function useCrawlSources() {
  return useQuery({
    queryKey: crawlerKeys.sources,
    queryFn: () => apiFetch<CrawlSource[]>("/api/crawler/sources"),
    refetchInterval: (q) => (q.state.data?.some((s) => busy(s.last_job?.status)) ? 3000 : false),
  });
}

export function useCrawlJobs(sourceId: string) {
  return useQuery({ queryKey: crawlerKeys.jobs(sourceId), queryFn: () => apiFetch<CrawlJobSummary[]>(`/api/crawler/sources/${enc(sourceId)}/jobs`) });
}

export function useCrawlJob(id: string | null) {
  return useQuery({
    queryKey: crawlerKeys.job(id ?? ""),
    queryFn: () => apiFetch<CrawlJob>(`/api/crawler/jobs/${enc(id!)}`),
    enabled: !!id,
    refetchInterval: (q) => (busy(q.state.data?.status) ? 2000 : false),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["crawler"] });
    void queryClient.invalidateQueries({ queryKey: reviewKeys.queue });
  };
}

export function useCreateCrawlSource() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateCrawlSourceRequest) => apiFetch<CrawlSource>("/api/crawler/sources", { method: "POST", body }),
    onSuccess: done,
  });
}

export function useUpdateCrawlSource() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: "active" | "paused" }) =>
      apiFetch<CrawlSource>(`/api/crawler/sources/${enc(id)}`, { method: "PATCH", body }),
    onSuccess: done,
  });
}

export function useDeleteCrawlSource() {
  const done = useInvalidate();
  return useMutation({ mutationFn: (id: string) => apiFetch<void>(`/api/crawler/sources/${enc(id)}`, { method: "DELETE" }), onSuccess: done });
}

export function useRobotsCheck() {
  return useMutation({ mutationFn: (id: string) => apiFetch<RobotsCheck[]>(`/api/crawler/sources/${enc(id)}/robots`, { method: "POST" }) });
}

export function useStartCrawl() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (sourceId: string) => apiFetch<CrawlJobSummary>(`/api/crawler/sources/${enc(sourceId)}/jobs`, { method: "POST" }),
    onSuccess: done,
  });
}

export function useCancelCrawl() {
  const done = useInvalidate();
  return useMutation({ mutationFn: (jobId: string) => apiFetch<CrawlJobSummary>(`/api/crawler/jobs/${enc(jobId)}/cancel`, { method: "POST" }), onSuccess: done });
}
