import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-linear-to-b from-brand-50 to-white px-4 text-center">
      <div>
        <p className="text-6xl font-bold text-brand-300">404</p>
        <h1 className="mt-3 text-xl font-semibold text-ink">Không tìm thấy trang</h1>
        <p className="mt-1 text-muted">Đường dẫn có thể đã thay đổi hoặc bài toán không còn tồn tại.</p>
        <Link href="/" className={buttonClasses({ className: "mt-6" })}>
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
