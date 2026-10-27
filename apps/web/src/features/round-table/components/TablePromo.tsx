import Link from "next/link";
import { ChevronRight, Orbit } from "lucide-react";

/** Lối vào Bàn tròn vũ trụ trên trang Đấu trường. */
export function TablePromo() {
  return (
    <Link
      href="/arena/table"
      className="group relative mb-6 flex items-center gap-4 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_20%_30%,#4c1d95_0,#0b0622_60%,#03050c_100%)] p-5 text-white shadow-sm"
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:26px_26px] opacity-15" aria-hidden />
      <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
        <Orbit className="size-6 text-violet-200" aria-hidden />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold">
          Bàn tròn vũ trụ <span className="rounded-full bg-violet-400/30 px-2 py-0.5 text-[11px] font-medium">Mới · 3D</span>
        </span>
        <span className="mt-0.5 block text-sm text-violet-100/85">4 người một bàn giữa không gian. Trả lời sai phải quay vòng hố đen, ai trụ lại cuối cùng thắng.</span>
      </span>
      <ChevronRight className="relative size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}
