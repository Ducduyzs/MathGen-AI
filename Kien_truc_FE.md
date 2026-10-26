# Kiến trúc Frontend – MathGen AI (Pha A)

> Tài liệu mô tả kiến trúc frontend cho nền tảng MathGen AI ở Pha A (tối đa ~1.000 người dùng đồng thời).
> Đi kèm tài liệu [Kien_truc_MathGen_Pha_A.docx](Kien_truc_MathGen_Pha_A.docx) (kiến trúc tổng thể, backend, hạ tầng).

---

## 1. Mục tiêu

| Mục tiêu | Chỉ tiêu |
|---|---|
| Phục vụ 3 vai trò | Học sinh, Giáo viên, Quản trị viên trên cùng một ứng dụng |
| SEO cho trang bài công khai | Trang bài được render sẵn HTML (kể cả công thức), Google đọc được |
| Hiển thị và nhập công thức toán | Công thức hiển thị đúng, nhanh; học sinh nhập được biểu thức trên cả điện thoại |
| Tốc độ | LCP < 2,5 s trên 4G; JS tải lần đầu của trang công khai < 200 KB (gzip) |
| Thiết bị | Ưu tiên điện thoại (mobile-first), dùng tốt trên máy tính bảng và máy tính |
| Không mất bài làm | Bài nộp không bị mất khi mạng chập chờn hoặc lỡ tải lại trang |

---

## 2. Công nghệ

| Hạng mục | Công nghệ | Ghi chú |
|---|---|---|
| Framework | **Next.js 15+ (App Router)**, React 19, TypeScript (`strict`) | Server Components cho trang công khai, Client Components cho phần tương tác |
| Giao diện | **Tailwind CSS 4**, **shadcn/ui** (Radix UI) | Component nằm trong repo, tùy biến thoải mái |
| Font | `next/font` với **Be Vietnam Pro** | Hiển thị tốt tiếng Việt, tự host, không giật layout |
| Hiển thị công thức | **KaTeX** | Render được ngay trên server |
| Nhập công thức | **MathLive** | Bàn phím toán ảo trên điện thoại; chỉ tải khi cần |
| Gọi API | **openapi-typescript** + **openapi-fetch** | Sinh kiểu dữ liệu từ OpenAPI của FastAPI → gọi API có kiểm tra kiểu |
| Server state | **TanStack Query 5** | Cache, refetch, polling, mutation |
| Form | **React Hook Form** + **Zod** | Kiểm tra dữ liệu form |
| Biểu đồ | **Recharts** | Hồ sơ năng lực, thống kê chất lượng |
| Kiểm thử | **Vitest** + Testing Library, **Playwright**, **MSW** | Unit/component, end-to-end, giả lập API |
| Theo dõi lỗi | **@sentry/nextjs** | Lỗi và hiệu năng phía trình duyệt lẫn server |
| Chất lượng mã | ESLint, Prettier | Chạy trong CI |

**Không dùng ở Pha A:** Redux (TanStack Query đã quản lý server state), thư viện i18n (giao diện chỉ có tiếng Việt), CSS-in-JS.

---

## 3. Vị trí của frontend trong hệ thống

```
Trình duyệt
   │ HTTPS
Cloudflare (CDN)
   │
Caddy ──"/"────► Next.js (container web)   ── render trang công khai (ISR), phục vụ JS/CSS
      └─"/api"─► FastAPI (container api)
```

- Frontend và API **cùng một domain** (Caddy định tuyến theo đường dẫn), vì vậy:
  - Không cần cấu hình CORS.
  - Cookie refresh token (`httpOnly`) tự gửi kèm request `/api/auth/refresh`.
- Trình duyệt gọi thẳng `/api/...`. Next.js **không** làm proxy trung gian cho API.
- Chỉ trang công khai mới gọi API từ phía server Next.js (khi render ISR), và chỉ đọc dữ liệu công khai, không cần đăng nhập.

---

## 4. Chiến lược render

| Loại trang | Cách render | Lý do |
|---|---|---|
| Trang chủ, giới thiệu | **Static** (build sẵn) | Nội dung ít thay đổi |
| Chi tiết bài công khai `/problems/[id]` | **ISR**, `revalidate = 3600` | SEO; HTML (kể cả KaTeX) có sẵn, Cloudflare cache được |
| Danh sách bài công khai `/problems` | **Server render** + cache theo bộ lọc | SEO cho trang theo lớp/chủ đề |
| Mọi trang sau đăng nhập (học sinh, giáo viên, admin) | **Client render** (TanStack Query) | Dữ liệu riêng của từng người, cần tương tác nhiều, không cần SEO |

**Quy tắc:** trang cần đăng nhập không dùng Server Component để lấy dữ liệu. Nhờ vậy server Next.js không bao giờ phải cầm token của người dùng, và luồng xác thực chỉ có một đường duy nhất.

---

## 5. Cấu trúc thư mục

```
apps/web/
├── src/
│   ├── app/                          # chỉ định tuyến + layout, không chứa logic nghiệp vụ
│   │   ├── (public)/                 # không cần đăng nhập, render trên server
│   │   │   ├── page.tsx              # trang chủ
│   │   │   └── problems/
│   │   │       ├── page.tsx          # danh sách bài
│   │   │       └── [id]/page.tsx     # chi tiết bài (ISR)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/                    # cần đăng nhập, render phía client
│   │   │   ├── layout.tsx            # AuthGuard + khung điều hướng theo vai trò
│   │   │   ├── practice/             # học sinh
│   │   │   ├── me/progress/          # học sinh
│   │   │   ├── teacher/              # giáo viên
│   │   │   └── admin/                # quản trị viên
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── layout.tsx                # font, Providers (QueryClient, Toaster)
│   ├── features/                     # mỗi nghiệp vụ một thư mục
│   │   ├── auth/
│   │   ├── problems/
│   │   ├── practice/
│   │   ├── progress/
│   │   ├── ingestion/
│   │   ├── review/
│   │   ├── problem-sets/
│   │   ├── classes/
│   │   └── admin/
│   ├── components/
│   │   ├── ui/                       # shadcn/ui (Button, Dialog, Table, ...)
│   │   ├── math/                     # MathText, MathRenderer, MathInput
│   │   └── layout/                   # Header, Sidebar, PageHeader
│   ├── lib/
│   │   ├── api/                      # client.ts, auth-token.ts, errors.ts
│   │   ├── query-client.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── api.d.ts                  # SINH TỰ ĐỘNG từ OpenAPI, không sửa tay
│   └── middleware.ts                 # chuyển hướng khi chưa đăng nhập
├── tests/e2e/                        # Playwright
├── public/
├── next.config.ts                    # output: "standalone"
└── Dockerfile
```

### Bên trong một feature

```
features/practice/
├── api.ts            # hàm gọi API + queryKey + hook useQuery/useMutation
├── components/       # component riêng của feature
├── hooks/            # hook riêng (ví dụ useExamTimer)
├── schemas.ts        # Zod schema cho form
└── index.ts          # export công khai của feature
```

### Quy tắc phụ thuộc

- `app/` chỉ ghép các component lấy từ `features/` vào trang. Logic nghiệp vụ không viết trong `page.tsx`.
- Feature này **không import file nội bộ** của feature khác, chỉ import qua `index.ts`. Thứ dùng chung thì đưa vào `components/` hoặc `lib/`.
- `components/` và `lib/` không được import từ `features/`.
- Import bằng alias `@/` (ví dụ `@/components/math`).

Các quy tắc này trùng với ranh giới module của backend (`users`, `ingestion`, `problem_bank`, `generation_verification`, `learning`), nhờ đó dễ biết tính năng nào gọi API nào.

---

## 6. Bản đồ trang

| Đường dẫn | Vai trò | Render | Chức năng |
|---|---|---|---|
| `/` | Tất cả | Static | Giới thiệu, lối vào luyện tập |
| `/problems` | Tất cả | Server | Tìm và lọc bài theo lớp, chủ đề, độ khó |
| `/problems/[id]` | Tất cả | ISR | Đề bài, gợi ý; lời giải hiện sau khi làm hoặc đăng nhập |
| `/login`, `/register` | Khách | Client | Đăng nhập, đăng ký |
| `/practice` | Học sinh | Client | Vòng luyện tập cá nhân hóa |
| `/practice/sets/[id]` | Học sinh | Client | Làm bộ đề giáo viên giao (chế độ thi, có đồng hồ) |
| `/me/progress` | Học sinh | Client | Hồ sơ năng lực theo kỹ năng, lịch sử làm bài |
| `/teacher/uploads` | Giáo viên | Client | Tải tài liệu lên, theo dõi tiến độ xử lý |
| `/teacher/review` | Giáo viên | Client | Hàng chờ duyệt bài do AI trích xuất/sinh |
| `/teacher/problem-sets` | Giáo viên | Client | Danh sách và tạo bộ đề (chọn chủ đề, độ khó, số câu) |
| `/teacher/classes` | Giáo viên | Client | Lớp học, giao bộ đề, xem kết quả |
| `/admin/sources` | Quản trị viên | Client | Quản lý nguồn dữ liệu |
| `/admin/users` | Quản trị viên | Client | Quản lý người dùng, vai trò |
| `/admin/quality` | Quản trị viên | Client | Acceptance Rate, Duplicate Rate, độ chính xác phân loại |

---

## 7. Xác thực và phân quyền

### Lưu token

| Token | Lưu ở đâu | Hạn |
|---|---|---|
| Access token (JWT) | **Bộ nhớ JavaScript** (biến trong module `auth-token.ts`) | 15 phút |
| Refresh token | Cookie `httpOnly; Secure; SameSite=Lax` do backend đặt | Dài hạn, thu hồi được |

**Không lưu token vào `localStorage`/`sessionStorage`**, vì script độc hại chèn vào trang (XSS) có thể đọc được ở đó.

### Luồng

```
Mở ứng dụng
  └─► POST /api/auth/refresh (cookie tự gửi kèm)
        ├─ thành công → giữ access token trong bộ nhớ → GET /api/me → biết vai trò
        └─ thất bại   → coi là khách

Mỗi request API
  └─► gắn header  Authorization: Bearer <access token>
        └─ nhận 401 → gọi refresh MỘT lần (các request đồng thời chờ chung) → thử lại request
                      └─ refresh thất bại → xóa trạng thái, chuyển về /login?next=<trang hiện tại>
```

### Bảo vệ trang

- `middleware.ts`: nếu vào `(app)/*` mà **không có cookie refresh**, chuyển hướng ngay về `/login`. Bước này chỉ để trải nghiệm tốt hơn, không phải lớp bảo mật.
- `(app)/layout.tsx` có `AuthGuard`: chờ `GET /api/me`, sau đó kiểm tra vai trò theo tiền tố đường dẫn (`/teacher/*` cần `teacher` hoặc `admin`, `/admin/*` cần `admin`).
- **Phân quyền thật nằm ở backend.** Frontend chỉ ẩn những gì người dùng không có quyền dùng.

---

## 8. Tầng dữ liệu

### Kiểu dữ liệu sinh từ backend

```bash
# chạy mỗi khi API thay đổi (cũng chạy trong CI để phát hiện lệch kiểu)
npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts
```

### API client

```ts
// src/lib/api/client.ts
import createClient from "openapi-fetch";
import type { paths } from "@/types/api";
import { getAccessToken } from "./auth-token";

export const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "" });

api.use({
  onRequest({ request }) {
    const token = getAccessToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
});
```

### Hook theo feature

```ts
// src/features/practice/api.ts
export const practiceKeys = {
  next: ["practice", "next"] as const,
};

export function useNextProblem() {
  return useQuery({
    queryKey: practiceKeys.next,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/practice/next");
      if (error) throw error;
      return data;
    },
    staleTime: Infinity, // chỉ đổi bài khi người dùng bấm "Bài tiếp"
  });
}
```

### Quy ước TanStack Query

| Dữ liệu | `staleTime` | Làm mới khi |
|---|---|---|
| Thông tin tài khoản (`/me`) | 5 phút | Đăng nhập/đăng xuất |
| Hồ sơ năng lực | 30 giây | Sau mỗi lần nộp bài |
| Bài toán | 1 giờ | Hầu như không đổi |
| Tiến độ xử lý upload | 0 | `refetchInterval: 3000` cho đến khi `status` là `done` hoặc `failed` |
| Hàng chờ duyệt | 0 | Sau mỗi lần duyệt/từ chối |

- `queryKey` khai báo tập trung trong `features/*/api.ts`, không viết chuỗi tùy ý ở component.
- Sau mutation: `invalidateQueries` đúng các key liên quan, không xóa toàn bộ cache.

### Phân loại trạng thái

| Loại trạng thái | Quản lý bằng |
|---|---|
| Dữ liệu từ server | TanStack Query |
| Dữ liệu form | React Hook Form + Zod |
| Bộ lọc, trang, tab | **URL search params**, để chia sẻ link và dùng được nút Back |
| Trạng thái giao diện nhỏ | `useState` trong component |
| Bài làm dở trong chế độ thi | `localStorage` (xem mục 10.2) |

---

## 9. Hiển thị và nhập công thức

### Hiển thị: `MathText` và `MathRenderer`

Đề bài là văn bản xen công thức, ví dụ `Giải phương trình $x^2 - 5x + 6 = 0$`. Component `MathText` tách theo `$...$` (cùng dòng) và `$$...$$` (khối riêng), phần công thức thì đưa cho `MathRenderer`.

```tsx
// src/components/math/MathRenderer.tsx  (không có "use client" → chạy được trên server)
import katex from "katex";

export function MathRenderer({ latex, display = false }: { latex: string; display?: boolean }) {
  const html = katex.renderToString(latex, { displayMode: display, throwOnError: false, trust: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
```

- Trang công khai render KaTeX **trên server**, nên trình duyệt chỉ nhận HTML + CSS mà không cần tải thư viện KaTeX.
- `trust: false` chặn các lệnh LaTeX nguy hiểm (`\href`, `\url`, ...). Đây là **chỗ duy nhất** được dùng `dangerouslySetInnerHTML`.
- `throwOnError: false`: công thức lỗi hiển thị màu đỏ thay vì làm hỏng cả trang.

### Nhập: `MathInput` (MathLive)

MathLive nặng, nên chỉ tải ở những trang có ô nhập biểu thức:

```tsx
"use client";
import dynamic from "next/dynamic";
const MathInput = dynamic(() => import("./MathInput"), { ssr: false });
```

### Ô nhập theo kiểu đáp án

Khớp với cách chấm của backend (mục 6.5 tài liệu kiến trúc tổng thể):

| Kiểu đáp án | Component | Gửi lên API |
|---|---|---|
| Trắc nghiệm | `ChoiceAnswer` (radio) | `{ "type": "choice", "value": "B" }` |
| Số | `NumberAnswer` (nhận `3/2`, `1,5`, `-0.75`) | `{ "type": "number", "value": "3/2" }` |
| Tập nghiệm | `SetAnswer` (thêm/bớt từng nghiệm) | `{ "type": "set", "value": ["2", "3"] }` |
| Giá trị tham số | `IntervalAnswer` (chọn dấu và nhập số) | `{ "type": "interval", "value": "m < 9/4" }` |
| Biểu thức | `MathInput` | `{ "type": "expression", "latex": "(x-2)(x-3)" }` |

Frontend chỉ kiểm tra định dạng (không để trống, đúng dạng số). **Việc chuẩn hóa và chấm luôn do backend làm.**

---

## 10. Các luồng giao diện chính

### 10.1. Vòng luyện tập (`/practice`)

```
Hiện bài ──► học sinh trả lời ──► POST /api/attempts
   ▲                                   │
   │                                   ▼
   │                         Hiện đúng/sai, gợi ý, lời giải
   │                         (đồng thời prefetch bài tiếp theo)
   └──────── bấm "Bài tiếp" ◄──────────┘   → hiện bài ngay, không phải chờ tải
```

- Sau khi nộp: `invalidateQueries(["me", "skills"])` và `prefetchQuery(practiceKeys.next)`.
- Hỗ trợ phím tắt: `Enter` để nộp, `N` để sang bài tiếp.

### 10.2. Làm bộ đề / chế độ thi (`/practice/sets/[id]`)

Mục tiêu là **không mất bài làm**:

1. Mỗi khi đổi đáp án, lưu bản nháp vào `localStorage` theo khóa `draft:{setId}`. Mọi lần đọc/ghi đều bọc `try/catch` (chế độ ẩn danh có thể chặn `localStorage`).
2. Mở lại trang thì khôi phục từ bản nháp.
3. Mỗi câu khi nộp mang một `client_attempt_id` (ULID sinh ở trình duyệt), gửi kèm header `Idempotency-Key`. Mạng lỗi thì tự thử lại; backend gặp lại cùng khóa thì không tạo bản ghi trùng.
4. Đồng hồ đếm ngược tính theo **thời điểm kết thúc do server trả về**, không theo đồng hồ máy học sinh.
5. Hết giờ thì tự nộp phần còn lại.
6. Nộp xong mới xóa bản nháp.

> **Yêu cầu với backend:** `POST /api/attempts` cần nhận `Idempotency-Key` (cột `client_attempt_id` UNIQUE trong bảng `attempts`).

### 10.3. Giáo viên tải tài liệu lên (`/teacher/uploads`)

```
Chọn file ──► kiểm tra phía client (PDF/DOCX/PNG/JPG, ≤ 20 MB)
          ──► POST /api/ingestion/upload-url      → nhận presigned URL
          ──► PUT file thẳng lên R2 (có thanh tiến độ)
          ──► POST /api/ingestion/sources         → nhận source_id
          ──► polling GET /api/ingestion/sources/{id} mỗi 3 giây
                 trạng thái: đang trích xuất → đang phân tích → đang kiểm chứng → xong / lỗi
          ──► xong: hiện số bài trích được, nút "Đi tới hàng chờ duyệt"
```

Thanh tiến độ upload dùng `XMLHttpRequest` (sự kiện `upload.onprogress`), vì `fetch` chưa báo được tiến độ upload.

### 10.4. Duyệt bài (`/teacher/review`)

- Bố cục hai cột: **bài gốc / nguồn** bên trái, **bài được trích xuất hoặc sinh ra** bên phải. Cột phải gồm đề, đáp án, lời giải, lớp, kỹ năng và độ khó dự đoán.
- Hiển thị **truy vết nguồn gốc** (`problem_lineage`): bài cha → luật biến đổi → bài này.
- Hiển thị kết quả kiểm chứng của SymPy (đạt/không đạt, chi tiết).
- Hành động: Duyệt (`A`), Từ chối kèm lý do (`R`), Sửa rồi duyệt, Bỏ qua (`S`). Duyệt xong tự chuyển sang bài kế tiếp.
- Dùng optimistic update: bài biến khỏi danh sách ngay, nếu API lỗi thì hoàn tác và báo lỗi.

### 10.5. Hồ sơ năng lực (`/me/progress`)

- Biểu đồ cột ngang thể hiện điểm từng kỹ năng (0–1), sắp xếp từ yếu đến mạnh, đúng như ví dụ trong đề tài (Linear Equation 0.92, …, Function 0.37).
- Mỗi kỹ năng có nút "Luyện kỹ năng này" → `/practice?skill=<code>`.

---

## 11. Giao diện và trải nghiệm

- **Mobile-first:** thiết kế cho màn hình 360 px trước. Vùng bấm tối thiểu 44 × 44 px. Bàn phím toán của MathLive bật tự động trên điện thoại.
- **Màu và kiểu chữ** khai báo bằng biến CSS trong `globals.css` (theme của shadcn/ui), không viết mã màu trực tiếp trong component.
- **Trạng thái đầy đủ:** mỗi màn hình đều có trạng thái đang tải (skeleton), rỗng (có hướng dẫn) và lỗi (có nút thử lại).
- **Khả năng tiếp cận:** dùng component Radix (đã hỗ trợ bàn phím và ARIA), mọi ô nhập có `label`, độ tương phản đạt WCAG AA.
- **Thông báo lỗi bằng tiếng Việt:** backend trả `code` lỗi, frontend ánh xạ sang câu thông báo trong `lib/api/errors.ts`.

---

## 12. Hiệu năng

| Biện pháp | Áp dụng |
|---|---|
| Render KaTeX trên server | Trang công khai không tải JS của KaTeX |
| `next/dynamic` | MathLive, Recharts, trình duyệt file upload |
| `next/image` | Ảnh đề thi, ảnh minh họa |
| `next/font` | Font tự host, không gây dịch chuyển layout |
| ISR + Cloudflare cache | Trang bài công khai gần như không chạm tới server |
| Prefetch | Bài tiếp theo trong vòng luyện tập; `<Link>` tự prefetch trang |
| Ngân sách | JS tải lần đầu trang công khai < 200 KB gzip; theo dõi bằng `@next/bundle-analyzer` |

---

## 13. Bảo mật phía frontend

- Token không lưu trong `localStorage` (mục 7).
- `dangerouslySetInnerHTML` chỉ dùng cho đầu ra của KaTeX với `trust: false`.
- Nội dung do người dùng hoặc AI tạo ra luôn hiển thị qua JSX hoặc `MathText`, không bao giờ chèn HTML thô.
- Header bảo mật trong `next.config.ts`: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`.
- Biến môi trường có tiền tố `NEXT_PUBLIC_` sẽ lộ ra trình duyệt, nên **không đặt bí mật** trong các biến này.
- Kiểm tra loại và kích thước file ở client chỉ để báo sớm cho người dùng. Backend vẫn kiểm tra lại.

---

## 14. Xử lý lỗi và giám sát

- `error.tsx` cho từng nhóm route: lỗi một trang không làm trắng cả ứng dụng.
- Lỗi mutation hiện toast (shadcn/ui `Sonner`). Lỗi tải dữ liệu hiện ngay tại vùng nội dung, kèm nút thử lại.
- Sentry: gắn `user.id` và vai trò (không gửi email); bật Session Replay với tỷ lệ mẫu thấp, che toàn bộ ô nhập.
- Gửi chỉ số Web Vitals (LCP, INP, CLS) lên Sentry để theo dõi tốc độ thực tế.

---

## 15. Kiểm thử

| Mức | Công cụ | Phạm vi |
|---|---|---|
| Unit | Vitest | Hàm tách công thức `MathText`, chuẩn hóa ô nhập số, ánh xạ lỗi |
| Component | Vitest + Testing Library + MSW | Các ô nhập đáp án, form tạo bộ đề, AuthGuard |
| End-to-end | Playwright | Đăng nhập → luyện tập → nộp bài; làm bộ đề có mất mạng giữa chừng; upload → duyệt bài |

CI chạy theo thứ tự: `lint` → `tsc --noEmit` → kiểm tra `api.d.ts` có khớp OpenAPI không → `vitest` → `next build` → Playwright (trên môi trường Docker Compose).

---

## 16. Build và triển khai

- `next.config.ts`: `output: "standalone"` giúp image Docker nhỏ (chỉ chứa phần cần để chạy).
- Dockerfile nhiều tầng: `deps` → `build` → `runner` (Node bản slim, chạy bằng user không phải root).
- Biến môi trường:

| Biến | Ví dụ | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | (để trống) | Cùng domain nên dùng đường dẫn tương đối `/api` |
| `API_INTERNAL_URL` | `http://api:8000` | Server Next.js gọi API trong mạng Docker khi render ISR |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...` | |
| `SENTRY_AUTH_TOKEN` | (bí mật) | Chỉ dùng lúc build để tải source map |

- Container `web` (khoảng 500 MB RAM) chạy sau Caddy, như trong tài liệu kiến trúc Pha A, mục 12.2.

---

## 17. Quy ước mã nguồn

- Tên file component dạng `PascalCase.tsx`, các file còn lại dạng `kebab-case.ts`.
- Mặc định là Server Component. Chỉ thêm `"use client"` ở component lá thực sự cần tương tác.
- Không gọi `fetch` trực tiếp trong component. Luôn qua `api` client và hook trong `features/*/api.ts`.
- Không sửa tay `src/types/api.d.ts`.
- Mỗi pull request có tính năng mới kèm ít nhất một test cho luồng chính của tính năng đó.
