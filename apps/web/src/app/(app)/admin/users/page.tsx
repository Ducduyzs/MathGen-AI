import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { UsersAdmin } from "@/features/admin";

export const metadata: Metadata = { title: "Người dùng" };

export default function UsersPage() {
  return (
    <div>
      <PageHeader title="Người dùng" description="Tạo tài khoản giáo viên, đổi vai trò, khóa tài khoản và đặt lại mật khẩu." />
      <UsersAdmin />
    </div>
  );
}
