import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CloudOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface">
      <LoaderCircle className="size-8 animate-spin text-brand-500" aria-label="Đang tải" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <Icon className="size-7" aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={CloudOff}
      title="Không tải được dữ liệu"
      description={message}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Thử lại
          </Button>
        )
      }
    />
  );
}
