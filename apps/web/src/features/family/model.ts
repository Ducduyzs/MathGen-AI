const dayFormat = new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });

/** Ngày (YYYY-MM-DD, giờ Việt Nam) → "T2, 27/10". */
export function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return dayFormat.format(new Date(y, m - 1, d));
}

/** "Học hôm nay", "Học lần cuối 3 ngày trước", "Chưa học". */
export function lastActiveLabel(day: string | null, today = new Date()) {
  if (!day) return "Chưa học";
  const [y, m, d] = day.split("-").map(Number);
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  if (days <= 0) return "Học hôm nay";
  if (days === 1) return "Học lần cuối hôm qua";
  return `Học lần cuối ${days} ngày trước`;
}
