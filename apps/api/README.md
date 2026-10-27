# MathGen AI – Backend

FastAPI, PostgreSQL 16, Redis 7 (cache và hàng đợi), Celery, SymPy. Tổ chức theo kiểu **modular monolith**, theo tài liệu [Kien_truc_MathGen_Pha_A.docx](../../Kien_truc_MathGen_Pha_A.docx). API khớp hợp đồng mà frontend đang dùng (xem [apps/web/README.md](../web/README.md)).

## Chạy ở môi trường dev

```bash
# 1. PostgreSQL + Redis
docker compose -f infra/docker-compose.yml up -d

# 2. Backend
cd apps/api
uv sync                               # cài thư viện vào .venv
cp .env.example .env
uv run alembic upgrade head           # tạo bảng
uv run python -m app.seed --demo      # dữ liệu mẫu + tài khoản thử (mật khẩu 123456)
uv run uvicorn app.main:app --reload --port 8000   # tài liệu API: http://localhost:8000/api/docs

# 3. (Tùy chọn) Worker thật thay cho chạy ngay trong tiến trình: đặt CELERY_EAGER=false ở .env rồi chạy
uv run celery -A app.workers.celery_app worker -Q learning --pool solo   # Windows cần --pool solo

# 4. Frontend dùng backend thật: ở apps/web/.env.local chọn "Chế độ 2" (xem apps/web/.env.example)
```

## Dùng Supabase làm database

Supabase là PostgreSQL được quản lý sẵn, nên backend dùng được mà không phải sửa code. Chỉ dùng phần **database** của Supabase; đăng nhập vẫn do backend tự làm (JWT + refresh cookie), nên **không cần** publishable key, secret key hay JWKS.

1. Vào Dashboard → **Connect** → **Session pooler**, chép chuỗi `postgresql://…` (cổng 5432, có IPv4).
2. Dán vào `apps/api/.env` theo mẫu "cách 2" trong `.env.example`: `DATABASE_URL=…` và `DATABASE_SSL=true`.
3. Chạy `uv run alembic upgrade head` rồi `uv run python -m app.seed --demo`.

**Lưu ý:**
- **Chọn vùng gần nơi API chạy.** Đo thực tế với project ở Sydney, gọi từ máy dev ở Việt Nam: mỗi lượt đi về mạng khoảng 300 ms, mỗi request mất **2–9 giây**. Production đặt API và database cùng vùng (ví dụ Singapore) thì độ trễ không đáng kể. Khi dev, nên dùng PostgreSQL trong Docker, còn Supabase để dùng chung trong nhóm hoặc làm bản demo.
- Test **luôn** chạy trên PostgreSQL trong Docker, kể cả khi `.env` đang trỏ tới Supabase. Lý do: mỗi lần chạy, test xóa rồi tạo lại database.
- Nếu dùng **Transaction pooler** (cổng 6543), đặt `DATABASE_PGBOUNCER=true` (backend sẽ tắt prepared statement) và `MIGRATION_DATABASE_URL` trỏ cổng 5432.

## Test

Test chạy trên PostgreSQL và Redis **thật** (cần bước 1). Database `mathgen_test` được tạo lại từ đầu bằng chính migration Alembic.

```bash
uv run pytest -q
```

## Cấu trúc

```
app/
├── core/            cấu hình, DB (phiên ghi / đọc), bảo mật (Argon2, JWT), lỗi {"code"}, Redis, deps
├── modules/
│   ├── users/          đăng ký, đăng nhập, refresh token (băm SHA-256, thu hồi được), /me
│   ├── problem_bank/   kỹ năng, ngân hàng bài (lọc, tìm kiếm trigram), hàng chờ duyệt
│   └── learning/       bài tiếp theo, chấm bài (Fraction, idempotency), tiến độ, mục tiêu ngày, chuỗi ngày
├── workers/         Celery (hàng đợi learning / ingest / verify / generate), phiên DB đồng bộ
├── seed/            dữ liệu mẫu (data.json xuất từ mock: cd apps/web && npm run seed:export)
└── main.py
migrations/          Alembic
tests/               pytest (auth, ngân hàng bài, luyện tập, worker)
```

**Quy tắc giữa các module:** module chỉ gọi `service.py` của module khác, không đọc bảng của nhau. Ví dụ `learning` lấy bài qua `problem_bank.service`.

## Những điểm đã áp dụng từ tài liệu kiến trúc

- **API stateless:** dùng JWT 15 phút. Refresh token nằm trong cookie `httpOnly`, ở DB chỉ lưu mã băm.
- **Chấm bài trong request** chỉ so với đáp án đã chuẩn hóa sẵn, dùng phân số chính xác (`Fraction`). **Không gọi SymPy trong request**; SymPy chạy trong worker.
- **Nộp lại không tạo bản ghi trùng:** ràng buộc duy nhất `(user_id, client_attempt_id)` cùng header `Idempotency-Key`.
- **Bảng `attempts` chỉ ghi thêm.** Điểm kỹ năng được cập nhật bằng task Celery `learning.update_skill_score`, có tự thử lại khi lỗi.
- **Khóa chính ULID.** Bài trong dữ liệu mẫu giữ mã `p01`…`p18` để khớp với mock.
- **Redis** lưu danh sách bài vừa phục vụ để không ra lại ngay. Redis lỗi thì vẫn phục vụ bài bình thường, chỉ mất tính năng tránh lặp.
- **Mục tiêu ngày và chuỗi ngày** tính theo giờ Việt Nam (UTC+7).

## Lộ trình

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| M1 | Hạ tầng, đăng nhập, ngân hàng bài, luyện tập, tiến độ, hàng chờ duyệt | ✅ |
| M2 | Làm đề (`/api/exams`): chuyển 42 dạng bài của bộ sinh đề sang Python, đề thi THPT | chưa |
| M3 | Tải đề và sinh biến thể (`/api/ingestion`, `/api/generation`): pipeline bằng SymPy trong worker | chưa |

Trước khi xong M2 và M3, frontend ở chế độ backend thật sẽ báo lỗi ở trang làm đề. Dùng chế độ mock nếu cần các trang đó.
