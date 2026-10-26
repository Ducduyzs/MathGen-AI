// Chỉ dùng trong Server Component (trang công khai, ISR). Không gắn token người dùng.

const BASE = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

export async function serverFetch<T>(path: string, revalidate = 3600): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} trả về ${res.status}`);
  return (await res.json()) as T;
}
