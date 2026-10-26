// Điểm import công khai riêng cho trang chủ. Không đi qua index.ts vì Next.js gộp mọi
// Client Component được import (kể cả không render) vào bundle của trang: import index
// sẽ kéo cả PracticeSession + KaTeX về trang chủ.
export { DailyProblem } from "./components/DailyProblem";
