"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, FullPageLoader } from "@/components/layout/States";
import { buttonClasses } from "@/components/ui/button";
import { canAccess, homeFor, useAuth } from "@/features/auth";

// AuthGuard: các trang trong (app) cần đăng nhập và render phía client.
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "guest") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) return <FullPageLoader />;

  return (
    <AppShell>
      {canAccess(user.role, pathname) ? (
        children
      ) : (
        <EmptyState
          icon={ShieldX}
          title="Bạn không có quyền truy cập trang này"
          action={
            <Link href={homeFor(user.role)} className={buttonClasses()}>
              Về trang của tôi
            </Link>
          }
        />
      )}
    </AppShell>
  );
}
