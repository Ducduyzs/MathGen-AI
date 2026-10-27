import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, ClipboardCheck, Database, FileUp, Library, ShieldCheck, Sigma, Sparkles, Target, WandSparkles } from "lucide-react";
import { MathText } from "@/components/math";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DailyProblem } from "@/features/practice/daily";

const PIPELINE: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: FileUp, title: "Thu thập", text: "PDF, Word, ảnh đề thi, LaTeX và nguồn mở có quyền sử dụng." },
  { icon: Sigma, title: "Chuẩn hóa", text: "Chuyển đề bài thành cấu trúc toán học như $ax^2 + bx + c = 0$." },
  { icon: WandSparkles, title: "Sinh biến thể", text: "Áp luật biến đổi để tạo bài mới theo độ khó." },
  { icon: ShieldCheck, title: "Kiểm chứng", text: "Bộ giải toán tự giải lại, kiểm tra ràng buộc và chống trùng." },
  { icon: Library, title: "Ngân hàng bài", text: "Chỉ lưu bài hợp lệ, kèm truy vết nguồn gốc." },
];

const AUDIENCES: { icon: LucideIcon; title: string; points: string[] }[] = [
  {
    icon: Target,
    title: "Học sinh",
    points: ["Luyện theo lớp và chủ đề", "Nhận bài phù hợp năng lực", "Xem gợi ý, lời giải và theo dõi tiến độ"],
  },
  {
    icon: ClipboardCheck,
    title: "Giáo viên",
    points: ["Tải tài liệu, đề thi lên hệ thống", "Tạo bộ đề theo chủ đề, độ khó, số câu", "Duyệt bài do AI sinh trước khi dùng"],
  },
  {
    icon: Database,
    title: "Quản trị viên",
    points: ["Quản lý nguồn dữ liệu", "Kiểm duyệt nội dung và người dùng", "Theo dõi chất lượng ngân hàng bài"],
  },
];

const VARIANTS = ["$x^2 - 7x + 12 = 0$", "$x^2 + x - 6 = 0$", "$x^2 - 5x + m = 0$"];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-linear-to-b from-brand-50 via-white to-white">
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-brand-100/70 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Badge className="px-3 py-1">Toán lớp 1–12</Badge>
            <h1 className="mt-5 text-4xl leading-tight font-bold tracking-tight text-ink sm:text-5xl">
              Luyện Toán thông minh với ngân hàng bài <span className="text-brand-600">được AI sinh và kiểm chứng</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Mỗi bài toán được chuẩn hóa thành cấu trúc, sinh biến thể theo độ khó và kiểm chứng bằng bộ giải toán trước khi đến tay bạn.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/practice" className={buttonClasses({ size: "lg" })}>
                Bắt đầu luyện tập <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/problems" className={buttonClasses({ variant: "outline", size: "lg" })}>
                Xem ngân hàng bài
              </Link>
            </div>
          </div>

          <Card className="p-6 shadow-lg shadow-brand-100 sm:p-8">
            <div className="flex items-center justify-between">
              <Badge tone="neutral">Bài gốc</Badge>
              <span className="text-xs text-muted">Lớp 9 · Phương trình bậc hai</span>
            </div>
            <MathText text="$$x^2 - 5x + 6 = 0$$" className="mt-2 block text-xl" />
            <div className="my-5 flex items-center gap-3 text-sm font-medium text-brand-700">
              <span className="h-px flex-1 bg-brand-200" />
              <Sparkles className="size-4" aria-hidden /> AI sinh biến thể
              <span className="h-px flex-1 bg-brand-200" />
            </div>
            <ul className="space-y-3">
              {VARIANTS.map((v) => (
                <li key={v} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                  <MathText text={v} />
                  <Badge tone="success">
                    <Check className="size-3" aria-hidden /> Đã kiểm chứng
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-ink sm:text-3xl">Từ một bài gốc đến cả ngân hàng bài</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
          Vòng tự làm giàu dữ liệu có kiểm soát: mọi bài sinh ra đều được kiểm chứng và lưu nguồn gốc.
        </p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PIPELINE.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl border border-line bg-white p-5">
              <span className="absolute top-4 right-4 text-xs font-semibold text-brand-300">0{i + 1}</span>
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <step.icon className="size-5" aria-hidden />
              </span>
              <p className="mt-4 font-semibold text-ink">{step.title}</p>
              <MathText text={step.text} className="mt-1 block text-sm text-muted" />
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <Badge className="px-3 py-1">Bài toán hôm nay</Badge>
            <h2 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">Thử sức ngay, không cần đăng nhập</h2>
            <p className="mt-3 text-muted">
              Mỗi ngày một bài chọn lọc. Đăng nhập để hệ thống ghi nhận kết quả, mở gợi ý từng bước và đề xuất bài tương tự khi bạn làm sai.
            </p>
          </div>
          <DailyProblem />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-ink sm:text-3xl">Dành cho ai?</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <Card key={a.title} className="p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white">
                  <a.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{a.title}</h3>
                <ul className="mt-3 space-y-2">
                  {a.points.map((p) => (
                    <li key={p} className="flex gap-2 text-muted">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-brand-200 bg-linear-to-r from-brand-50 to-brand-100 px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Sẵn sàng luyện tập?</h2>
          <p className="max-w-xl text-muted">Tạo tài khoản miễn phí, hệ thống sẽ chọn bài phù hợp với năng lực của bạn.</p>
          <Link href="/register" className={buttonClasses({ size: "lg" })}>
            Tạo tài khoản <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
