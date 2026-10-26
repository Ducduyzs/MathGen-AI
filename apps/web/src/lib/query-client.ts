import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api/errors";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Lỗi 4xx là lỗi nghiệp vụ, thử lại không có ích.
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  });
}
