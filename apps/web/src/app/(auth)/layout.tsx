import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-linear-to-b from-brand-50 to-white px-4 py-10 sm:py-16">
      <Link href="/" aria-label="MathGen AI – Trang chủ">
        <Logo />
      </Link>
      <div className="mt-8 w-full max-w-md">{children}</div>
    </div>
  );
}
