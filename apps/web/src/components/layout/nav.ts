import type { LucideIcon } from "lucide-react";
import {
  Award,
  ClipboardCheck,
  Database,
  FileStack,
  FileText,
  Gauge,
  HeartHandshake,
  Library,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  UserCog,
  Users,
} from "lucide-react";
import type { Role } from "@/types/api";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
  /** Các trang con nằm ngoài href nhưng thuộc mục này (báo cáo bài giao thuộc Lớp học). */
  also?: string[];
}

const STUDENT: NavItem[] = [
  { href: "/practice", label: "Luyện tập", icon: Target },
  { href: "/exams", label: "Làm đề", icon: FileText },
  { href: "/arena", label: "Đấu trường", icon: Trophy },
  { href: "/classes", label: "Lớp học", icon: Users },
  { href: "/me/progress", label: "Tiến độ", icon: TrendingUp },
  { href: "/me/achievements", label: "Thành tích", icon: Award },
  { href: "/problems", label: "Ngân hàng bài", icon: Library },
];

const TEACHER: NavItem[] = [
  { href: "/teacher/review", label: "Duyệt bài", icon: ClipboardCheck },
  { href: "/teacher/uploads", label: "Tải tài liệu", icon: Upload },
  { href: "/teacher/problem-sets", label: "Bộ đề", icon: FileStack },
  { href: "/teacher/classes", label: "Lớp học", icon: Users, also: ["/teacher/assignments"] },
  { href: "/problems", label: "Ngân hàng bài", icon: Library },
];

const PARENT: NavItem[] = [{ href: "/parent", label: "Con của tôi", icon: HeartHandshake }];

const ADMIN: NavItem[] = [
  { href: "/admin/sources", label: "Nguồn dữ liệu", icon: Database, soon: true },
  { href: "/admin/users", label: "Người dùng", icon: UserCog, soon: true },
  { href: "/admin/quality", label: "Chất lượng", icon: Gauge, soon: true },
];

export function sectionsFor(role: Role) {
  if (role === "student") return [{ title: "Học tập", items: STUDENT }];
  if (role === "teacher") return [{ title: "Giảng dạy", items: TEACHER }];
  if (role === "parent") return [{ title: "Gia đình", items: PARENT }];
  return [
    { title: "Giảng dạy", items: TEACHER },
    { title: "Quản trị", items: ADMIN },
  ];
}
