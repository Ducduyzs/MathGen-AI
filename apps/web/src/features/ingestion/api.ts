import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewKeys } from "@/features/review";
import { ApiError, toApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/http";
import type {
  GenerateVariantsRequest, IngestionSource, IngestionSourceSummary, SubmitVariantsRequest, UploadUrlResponse, Variant,
} from "@/types/api";

export const ingestionKeys = {
  sources: ["ingestion", "sources"] as const,
  source: (id: string) => ["ingestion", "sources", id] as const,
};

/** Giống backend: PDF, Word, ảnh, văn bản; tối đa 20 MB. */
export const ACCEPTED_EXTENSIONS = ["pdf", "docx", "png", "jpg", "jpeg", "txt", "tex", "md"];
export const MAX_UPLOAD_MB = 20;

export function useSources() {
  return useQuery({
    queryKey: ingestionKeys.sources,
    queryFn: () => apiFetch<IngestionSourceSummary[]>("/api/ingestion/sources"),
  });
}

/** Trong lúc pipeline chạy thì hỏi lại tiến trình; xong (hoặc lỗi) thì dừng. */
export function useSource(id: string) {
  return useQuery({
    queryKey: ingestionKeys.source(id),
    queryFn: () => apiFetch<IngestionSource>(`/api/ingestion/sources/${encodeURIComponent(id)}`),
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 800 : false),
  });
}

/** Tải file lên link ký sẵn (đi thẳng tới kho lưu trữ, không qua API), rồi tạo nguồn để pipeline xử lý. */
async function uploadFile(file: File): Promise<string> {
  const { upload_url, file_key } = await apiFetch<UploadUrlResponse>("/api/ingestion/upload-url", {
    method: "POST",
    body: { filename: file.name, content_type: file.type || "application/octet-stream", size: file.size },
  });
  let res: Response;
  try {
    res = await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
  } catch {
    throw new ApiError(0, "network_error");
  }
  if (!res.ok) throw await toApiError(res);
  return file_key;
}

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; file?: File; text?: string }) => {
      const file_key = input.file ? await uploadFile(input.file) : undefined;
      return apiFetch<IngestionSource>("/api/ingestion/sources", {
        method: "POST",
        body: { name: input.name, file_key, text: input.file ? undefined : input.text },
      });
    },
    onSuccess: (src) => {
      queryClient.setQueryData(ingestionKeys.source(src.id), src);
      void queryClient.invalidateQueries({ queryKey: ingestionKeys.sources });
    },
  });
}

export function useGenerateVariants() {
  return useMutation({
    mutationFn: (body: GenerateVariantsRequest) => apiFetch<Variant[]>("/api/generation/variants", { method: "POST", body }),
  });
}

export function useSubmitVariants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitVariantsRequest) =>
      apiFetch<{ added: number }>("/api/generation/variants/submit", { method: "POST", body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: reviewKeys.queue }),
  });
}
