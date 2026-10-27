import type { Role } from "@/types/api";

export const ROLE_LABEL: Record<Role, string> = {
  student: "Học sinh",
  teacher: "Giáo viên",
  admin: "Quản trị viên",
  parent: "Phụ huynh",
};

export function homeFor(role: Role) {
  if (role === "student") return "/practice";
  if (role === "parent") return "/parent";
  return "/teacher/review";
}

/** Chỉ để ẩn/hiện giao diện; phân quyền thật nằm ở backend. */
export function canAccess(role: Role, pathname: string) {
  if (pathname.startsWith("/admin")) return role === "admin";
  if (pathname.startsWith("/teacher")) return role === "teacher" || role === "admin";
  if (pathname.startsWith("/parent")) return role === "parent";
  // Phụ huynh chỉ xem tiến độ của con, không làm bài
  if (role === "parent") return false;
  return true;
}

/** Chặn open redirect: chỉ nhận đường dẫn nội bộ. */
export function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}
