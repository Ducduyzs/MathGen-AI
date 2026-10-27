import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Providers } from "./providers";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "MathGen AI – Luyện Toán lớp 1–12", template: "%s | MathGen AI" },
  description: "Ngân hàng bài Toán lớp 1–12 được AI sinh và kiểm chứng, luyện tập cá nhân hóa theo năng lực.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
