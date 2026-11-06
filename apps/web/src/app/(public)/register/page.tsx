import type { Metadata } from "next";
import Link from "next/link";
import { AuthModal, RegisterForm } from "@/features/auth";
import HomePage from "../page";

export const metadata: Metadata = { title: "Đăng ký" };

export default function RegisterPage() {
  return (
    <>
      <HomePage />
      <AuthModal
        title="Tạo tài khoản"
        subtitle="Miễn phí cho học sinh lớp 1–12."
        footer={
          <>
            Đã có tài khoản?{" "}
            <Link href="/login" scroll={false} className="font-medium text-brand-700 hover:underline">
              Đăng nhập
            </Link>
          </>
        }
      >
        <RegisterForm />
      </AuthModal>
    </>
  );
}
