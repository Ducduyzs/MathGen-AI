# MathGen AI – Frontend

Next.js 15 (App Router) + TypeScript + Tailwind CSS 4. Kiến trúc: [../../Kien_truc_FE.md](../../Kien_truc_FE.md).

## Chạy

```bash
npm install
cp .env.example .env.local   # đã bật MOCK_API=1
npm run dev                  # http://localhost:3000
```

Tài khoản thử (mật khẩu `123456`): `hs@mathgen.vn` (học sinh), `gv@mathgen.vn` (giáo viên), `admin@mathgen.vn` (quản trị), `ph@mathgen.vn` (phụ huynh, đã liên kết với học sinh mẫu).

## Mock API

Khi chưa có backend FastAPI, `src/app/api/[...path]/route.ts` + `src/mocks/` giả lập các endpoint `/api/*` theo đúng hợp đồng trong tài liệu kiến trúc. Code frontend gọi đường dẫn thật, nên khi có backend:

1. Đặt `MOCK_API=0`, `NEXT_PUBLIC_MOCK_API=0`, `API_INTERNAL_URL=http://localhost:8000`.
2. Cho `/api` đi tới FastAPI (Caddy ở production; khi dev có thể thêm `rewrites` trong `next.config.ts`).
3. Thay `src/types/api.ts` bằng kiểu sinh từ OpenAPI: `npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts`.

## Hợp đồng API frontend đang dùng (backend cần hỗ trợ)

| Endpoint | Trường / tham số | Ý nghĩa |
|---|---|---|
| `GET /api/problems/{id}`, `GET /api/practice/next` | `hints: string[]` | Gợi ý theo bước, frontend mở lần lượt |
| `GET /api/problems` | `level=1..4` | Lọc theo 4 mức: Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao |
| `GET /api/practice/next` | `similar_to={problem_id}` | Bài cùng dạng với bài vừa sai (có thể là biến thể do generator sinh) |
| `POST /api/attempts` | header `Idempotency-Key`; `hints_used: number` | Không tạo bản ghi trùng khi gửi lại; đúng nhờ gợi ý thì cộng ít điểm kỹ năng hơn |
| `GET /api/me/progress` | `daily_goal`, `today_attempts`, `streak_days` | Mục tiêu bài/ngày và chuỗi ngày học |
| `POST /api/exams` | `{ mode, size, skills? }` | Đề ôn tập: trắc nghiệm 10/20/40/100 câu (~80% A/B/C/D + ~20% Đúng/Sai) hoặc tự luận điền số 5/10/20/40 câu |
| `POST /api/exams` | `{ kind: "official", blueprint: "thpt" }` | Đề thi tốt nghiệp THPT: 12 + 4 + 6 câu, 90 phút, `ends_at` do server tính |
| `POST /api/exams` | `{ retry_of }` · `{ templates: [...] }` | Làm lại các câu sai · đề ôn tập mới chỉ gồm các dạng đã sai |
| `GET /api/exams`, `GET /api/exams/{id}` | `kind`, `ends_at`, `result` | Danh sách đề gần đây · chi tiết đề (không kèm đáp án trước khi nộp) |
| `POST /api/exams/{id}/submit` | `{ answers }` → `result.parts`, `items[].points` | Chấm: Phần I 0,25 · Phần II 0,1/0,25/0,5/1 theo số ý đúng · Phần III 0,5; nộp lại trả kết quả cũ |

## Màu chủ đạo

Trắng + xanh dương nhạt, khai báo trong `src/app/globals.css` (`@theme`): `brand-50…300` cho nền/viền/điểm nhấn, `brand-600` cho nút chính (tương phản ≥ 4.5:1 với chữ trắng).

## Đã có / chưa có

| Trang | Trạng thái |
|---|---|
| `/`, `/problems`, `/problems/[id]` (ISR, KaTeX render trên server) | ✅ |
| `/login`, `/register` | ✅ |
| `/practice` – trắc nghiệm, số, tập nghiệm; gợi ý từng bước (có thời gian chờ), phiên 10 câu + tổng kết, "Thử bài tương tự" khi sai, mục tiêu ngày, thanh hành động dính đáy trên điện thoại | ✅ |
| `/me/progress` – mục tiêu ngày + chuỗi, 4 mức thành thạo, lịch sử làm bài | ✅ |
| Trang chủ – "Bài toán hôm nay" cho khách làm thử (công thức render trên server) | ✅ |
| `/teacher/review` – duyệt/từ chối/bỏ qua, phím A/R/S, optimistic update | ✅ |
| `/exams` – tab Đề ôn tập / Đề thi (tốt nghiệp THPT), đề gần đây | ✅ |
| `/exams/[id]` – cuộn dọc, bảng ô câu hỏi bên trái, đồng hồ 90 phút + tự nộp, chấm theo phần, làm lại câu sai / đề mới từ dạng đã sai, lưu nháp | ✅ |
| Đề kiểm tra định kỳ lớp 6–11 (CV 7991), tự luận trình bày lời giải | Chưa làm: cần ma trận của Sở và giáo viên chấm |
| `/practice/sets/[id]` (chế độ thi), `/teacher/uploads`, `/teacher/problem-sets`, `/teacher/classes`, `/admin/*` | Chưa làm (menu ghi "Sắp có") |
| Ô nhập biểu thức (MathLive), ESLint, Vitest, Playwright, Sentry | Chưa làm |
