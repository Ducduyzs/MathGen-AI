import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth";

export const metadata: Metadata = { title: "Đăng ký" };

export default function RegisterPage() {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-ink">Tạo tài khoản</h1>
      <p className="mt-1 text-muted">Miễn phí cho học sinh lớp 1–12.</p>
      <div className="mt-6">
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </Card>
  );
}
