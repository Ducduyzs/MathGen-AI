import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthModal, LoginForm } from "@/features/auth";
import HomePage from "../page";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <>
      <HomePage />
      <AuthModal
        title="Đăng nhập"
        subtitle="Chào mừng bạn quay lại!"
        footer={
          <>
            Chưa có tài khoản?{" "}
            <Link href="/register" scroll={false} className="font-medium text-brand-700 hover:underline">
              Đăng ký
            </Link>
          </>
        }
      >
        <Suspense>
          <LoginForm />
        </Suspense>
      </AuthModal>
    </>
  );
}
