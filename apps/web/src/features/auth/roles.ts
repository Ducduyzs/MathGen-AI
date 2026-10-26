import type { Role } from "@/types/api";

export const ROLE_LABEL: Record<Role, string> = {
  student: "Học sinh",
  teacher: "Giáo viên",
  admin: "Quản trị viên",
};

export function homeFor(role: Role) {
  return role === "student" ? "/practice" : "/teacher/review";
}

/** Chỉ để ẩn/hiện giao diện; phân quyền thật nằm ở backend. */
export function canAccess(role: Role, pathname: string) {
  if (pathname.startsWith("/admin")) return role === "admin";
  if (pathname.startsWith("/teacher")) return role === "teacher" || role === "admin";
  return true;
}

/** Chặn open redirect: chỉ nhận đường dẫn nội bộ. */
export function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}
