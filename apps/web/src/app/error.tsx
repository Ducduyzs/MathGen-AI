"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <p className="text-5xl font-bold text-brand-300">Ối!</p>
        <h1 className="mt-3 text-xl font-semibold text-ink">Trang này gặp lỗi</h1>
        <p className="mt-1 text-muted">Bạn thử tải lại nhé. Nếu vẫn lỗi, hãy quay lại sau ít phút.</p>
        <Button className="mt-6" onClick={reset}>
          Thử lại
        </Button>
      </div>
    </div>
  );
}
