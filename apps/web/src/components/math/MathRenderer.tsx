import katex from "katex";

// Không có "use client": render được trên server, trang công khai chỉ nhận HTML + CSS.
// Đây là chỗ duy nhất dùng dangerouslySetInnerHTML; trust: false chặn \href, \url, ...
export function MathRenderer({ latex, display = false }: { latex: string; display?: boolean }) {
  // strict: "ignore" để chữ tiếng Việt trong \text{} không sinh cảnh báo.
  const html = katex.renderToString(latex, { displayMode: display, throwOnError: false, trust: false, strict: "ignore" });
  return <span className={display ? "block overflow-x-auto" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}
