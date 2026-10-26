import { getAccessToken, notifyUnauthorized, setAccessToken } from "./auth-token";
import { ApiError, toApiError } from "./errors";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

let refreshing: Promise<boolean> | null = null;

/** Gọi refresh một lần; các request đồng thời dùng chung promise này. */
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/api/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (res) => {
      if (!res.ok) {
        setAccessToken(null);
        return false;
      }
      const data = (await res.json()) as { access_token: string };
      setAccessToken(data.access_token);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Options = Omit<RequestInit, "body"> & { body?: unknown };

/**
 * Gọi API từ trình duyệt: tự gắn access token, gặp 401 thì refresh một lần rồi thử lại.
 * `retry = false` cho các endpoint xác thực (đăng nhập, đăng ký, đăng xuất).
 */
export async function apiFetch<T>(path: string, options: Options = {}, retry = true): Promise<T> {
  const { body, headers, ...init } = options;
  const h = new Headers(headers);
  const token = getAccessToken();
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) h.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: h,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network_error");
  }

  if (res.status === 401 && retry) {
    if (await refreshAccessToken()) return apiFetch<T>(path, options, false);
    notifyUnauthorized();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
