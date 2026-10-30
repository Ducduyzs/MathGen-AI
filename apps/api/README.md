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
uv run celery -A app.workers.celery_app worker -Q learning,ingest --pool solo   # Windows cần --pool solo

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
│   ├── problem_bank/   kỹ năng, ngân hàng bài (lọc, tìm kiếm trigram), hàng chờ duyệt → duyệt thì vào ngân hàng
│   ├── learning/       bài tiếp theo, chấm bài (Fraction, idempotency), tiến độ, mục tiêu ngày, chuỗi ngày, XP · nhiệm vụ · huy hiệu
│   ├── exams/          làm đề: 62 dạng bài (generator/: 20 dạng tiểu học lớp 1–5), đề ôn tập, đề thi THPT, chấm Đúng/Sai từng phần, làm lại câu sai
│   ├── classroom/      lớp học (mã vào lớp), giao bài có hạn nộp / đảo câu, báo cáo lớp, bảng xếp hạng
│   ├── problem_sets/   bộ đề giáo viên soạn: chọn câu theo dạng bài, đổi số liệu, sắp xếp, nhân bản, giao cho lớp
│   ├── arena/          Đấu trường: làm đề tính giờ 5/15/30 phút, rank Đồng → Cao thủ, bảng điểm cao tuần
│   ├── crawler/        bộ gom đề từ nguồn được phép: robots.txt, phạm vi tên miền/thư mục, đưa vào pipeline tải đề → hàng chờ duyệt
│   ├── regions/        34 tỉnh/thành mới (+ tên tỉnh cũ), trường học; nhận diện tỉnh/trường/kỳ thi/năm học từ phần đầu đề
│   ├── quality/        bảng chất lượng nội dung (quản trị): độ phủ kỹ năng, duyệt bài, bài nghi sai đáp án, pipeline, bộ gom
│   ├── round_table/    Bàn tròn vũ trụ: 4 người một bàn (ghế trống có máy), sai thì quay vòng hố đen, trạng thái trong Redis
│   ├── family/         phụ huynh: mã liên kết (một lần, 24 giờ), xem tiến độ / bài lớp giao / đề đã làm của con
│   └── ingestion/      tải đề (link ký sẵn), pipeline 5 bước trong worker, sinh biến thể có kiểm chứng
│       └── pipeline/   phân tích biểu thức → nhận dạng 9 dạng → giải chính xác → dạng chuẩn chống trùng → SymPy kiểm chứng
├── workers/         Celery (hàng đợi learning / ingest), phiên DB đồng bộ
├── seed/            dữ liệu mẫu (data.json xuất từ mock: cd apps/web && npm run seed:export)
└── main.py
migrations/          Alembic
tests/               pytest (auth, ngân hàng bài, luyện tập, làm đề, lớp học, bộ đề, đấu trường, phụ huynh, tải đề, worker)
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
- **Làm đề:** câu hỏi sinh và lưu kèm đáp án khi tạo đề, chấm chỉ so với đáp án đã lưu. Nộp lại trả kết quả cũ (khóa dòng
  `SELECT … FOR UPDATE`). Hạn nộp (`ends_at`) do server tính. Điểm kỹ năng sau khi nộp đề cập nhật trong worker (trọng số 0,05/câu).
- **Tải đề:** trình duyệt PUT file thẳng vào link ký sẵn (HMAC, 15 phút), không đi qua token đăng nhập — cùng cách dùng
  presigned URL của R2/S3. Dev lưu ở `var/uploads/`. Worker `ingest` ghi tiến trình sau mỗi bước để giao diện hiển thị.
- **Pipeline:** cùng thuật toán với bản TypeScript trong mock; đã đối chiếu 3.629 đề, hai bên cho kết quả giống hệt.
  Số học dùng phân số chính xác nên sinh biến thể chạy được trong request (< 1 giây cho 10 biến thể);
  SymPy chỉ chạy trong worker để kiểm chứng độc lập lời giải.
- **Đấu trường:** chỉ câu đang hỏi được lưu kèm đáp án (`arena_runs.current`), giờ kết thúc do server giữ (trễ tối đa 5 giây);
  bảng xếp hạng lấy lượt cao nhất mỗi người bằng `DISTINCT ON`, tuần tính từ 0 giờ thứ Hai giờ Việt Nam.
- **Phần thưởng** (`learning/rewards.py`): mọi hoạt động (luyện tập, đề, Đấu trường) đi qua `learning.record_activity` trong cùng
  giao dịch, cộng XP, chấm nhiệm vụ ngày (3 nhiệm vụ cố định theo học sinh + ngày) và huy hiệu. Ngày nghỉ được đóng băng
  khi ghi hoạt động kế tiếp; các API chỉ đọc tự tính như đã đóng băng nên không phải ghi gì.
- **Lớp 1–12:** kỹ năng có khoảng lớp (`skills.grade_min/grade_max`). Không chọn chủ đề thì đề ôn tập, luyện tập tự chọn chỉ lấy
  nội dung cùng cấp học với học sinh; tiểu học còn giới hạn tới lớp trên kế tiếp (lớp 2 không gặp phân số lớp 4).
  Ngân hàng có sẵn 10 bài/dạng tiểu học do seed sinh với hạt giống cố định (`g_<mã dạng>_<số>`).
- **Bộ gom** (`crawler/`): chỉ chạy với nguồn quản trị viên đã khai báo giấy phép (đề thi cơ quan nhà nước, CC0/CC BY/CC BY-SA,
  phạm vi công cộng, hoặc có văn bản cho phép kèm bằng chứng). Worker `ingest` đi BFS trong tên miền + thư mục đã khai báo, tuân thủ
  robots.txt (RFC 9309), Crawl-delay, thẻ noindex, tự xưng danh `MathGenBot`, chặn địa chỉ nội bộ (kể cả qua chuyển hướng), giới hạn
  20 MB/tài liệu. Trang HTML / PDF / DOCX có từ 2 câu đánh số → pipeline tải đề; câu nhận dạng + kiểm chứng đủ, không trùng ngân hàng
  hay hàng chờ → hàng chờ duyệt với `source = {name, url, site, license}`. Nội dung không đổi thì lần sau bỏ qua (băm nội dung).
- **Khu vực** (`regions/`): 34 đơn vị hành chính cấp tỉnh từ 1/7/2025; đề ghi tỉnh cũ ("Sở GD&ĐT Bình Dương") xếp vào tỉnh mới, giữ
  tên gốc. Pipeline tải đề nhận diện tỉnh, trường, kỳ thi, năm học từ ~25 dòng đầu (`ingestion_sources.region`); bộ gom gộp với khu vực
  mặc định của nguồn, tạo trường trong danh mục và ghi vào `source` của bài chờ duyệt → khi duyệt, `problems.province_code / school_id /
  exam_kind / exam_year`. Đề theo khu vực (`POST /api/exams` với `province`, `school_id`): câu thật cùng trường trước, rồi cùng tỉnh,
  lớp gần lớp học sinh; thiếu thì bổ sung câu tự sinh cùng cấp học.
- **Khóa tài khoản** (`users.disabled_at`): chặn ở đăng nhập, làm mới phiên và mọi request (`current_user`); khóa hoặc đặt lại mật khẩu
  thì thu hồi mọi refresh token. Quản trị viên không tự đổi vai trò / tự khóa được và luôn còn ít nhất một quản trị viên hoạt động.
- **Bài nghi sai đáp án** (`learning.suspicious_problems`): từ 5 lượt làm mà tỉ lệ đúng ≤ 25%.
- **Đề tương tự:** học sinh tải đề lên (`/api/ingestion/sources`, tài liệu riêng của mình) → pipeline nhận dạng → mỗi câu nhận dạng
  được sinh 1–3 biến thể cùng dạng (đổi số liệu, kiểm chứng lại). Tự luận: trả lời ngắn; dạng không có một đáp số (tập nghiệm) đổi sang
  câu hỏi có đáp số hoặc trắc nghiệm để vẫn chấm tự động. Sinh biến thể / gửi duyệt vào ngân hàng vẫn chỉ giáo viên.
- **OCR** (`ingestion/pipeline/ocr.py`): ảnh và PDF không có lớp chữ gửi tới Gemini (đọc cả PDF), GPT dự phòng cho ảnh; kết quả theo
  quy ước của pipeline ("Câu 1.", "A.", x^2). Khóa: `GEMINI_API_KEY` / `OPENAI_API_KEY` trong `.env`.
- **Mô hình phân loại** (`classifier/`): XLM-R base đã train (ml/). Bật: `uv pip install torch --index-url
  https://download.pytorch.org/whl/cpu` + `uv sync --group ml`, rồi `python ml/scripts/export_classifier.py --run
  ml/runs/2026-10-27_real/out/base_real40 --base-config <xlm-roberta-base> --dest apps/api/var/models/classifier`. Nạp ở nền khi
  API / worker khởi động (~1 phút), suy luận CPU ~0,2 giây/câu. Thiếu thư viện hoặc mô hình thì tự tắt, app chạy như cũ.
  Đầu "lớp" bị giới hạn trong khoảng của cấp đã đoán (THCS 6–9, THPT 10–12) để hai đầu ra không mâu thuẫn.
- **Rank Đấu trường** (`arena/ranks.py`): một bảng rank chung; lượt từ 3 câu được cộng/trừ theo điểm/phút so với mức
  chuẩn của bậc hiện tại (lượt dài tính nặng hơn), ghi `arena_runs.rank_delta` một lần khi lượt kết thúc.
- **Bàn tròn vũ trụ:** trạng thái phòng là JSON trong Redis (TTL 3 giờ), mọi thay đổi chạy dưới khóa Redis của phòng.
  Không có tiến trình nền: mỗi request tự đẩy ván tới thời điểm hiện tại, client hỏi lại mỗi giây. Ô hố đen của từng người
  được chọn sẵn và chỉ nằm ở server; hết ván mới ghi các câu của người thật vào `learning.record_activity`.
- **Bộ đề → bài giao** là bản chụp: sửa bộ đề sau khi giao không đổi bài học sinh đang làm.
- **Chống trùng:** khóa dạng chuẩn (quy đồng, chia ước chung, hệ số đầu dương) → SHA-256, lưu ở `problems.canonical_hash` (UNIQUE).

## Lộ trình

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| M1 | Hạ tầng, đăng nhập, ngân hàng bài, luyện tập, tiến độ, hàng chờ duyệt | ✅ |
| M2 | Làm đề (`/api/exams`): 42 dạng bài bằng Python, đề ôn tập, đề thi THPT | ✅ |
| M3 | Tải đề và sinh biến thể (`/api/ingestion`, `/api/generation`), duyệt bài vào ngân hàng | ✅ |
| M3.5 | Lớp học & giao bài (`/api/classes`, `/api/assignments`, `/api/me/assignments`): mã vào lớp, hạn nộp, đảo câu, báo cáo từng câu / kỹ năng, xuất bảng điểm, bảng xếp hạng | ✅ |
| M3.6 | Bộ đề (`/api/problem-sets`, in đề kèm đáp án ở frontend), Đấu trường (`/api/arena`), tài khoản phụ huynh (`/api/children`, `/api/me/parent-code`) | ✅ |
| M3.7 | Phần thưởng kiểu Duolingo (`/api/me/rewards`): XP, nhiệm vụ hằng ngày, đóng băng chuỗi, 12 huy hiệu | ✅ |
| M3.9 | Rank Đấu trường (`/api/arena/ranking`); Bàn tròn vũ trụ chuyển sang khu Trò chơi (`/games`) | ✅ |
| M3.8 | Bàn tròn vũ trụ (`/api/round-table`): chế độ 4 người, cảnh 3D (three.js) ở frontend | ✅ |
| M3.10 | Mở rộng lớp 1–5: 8 kỹ năng, 20 dạng bài, kho Đấu trường / Bàn tròn "Tiểu học" | ✅ |
| M3.11 | Bộ gom đề từ nguồn được phép (`/api/crawler`, trang quản trị Nguồn dữ liệu) | ✅ |
| M3.12 | Khu vực: tỉnh/trường cho đề thu thập, đề theo khu vực, lọc ngân hàng theo tỉnh (`/api/regions`) | ✅ |
| M3.13 | Quản trị: người dùng (`/api/admin/users`: tạo, đổi vai trò, khóa, đặt lại mật khẩu) và chất lượng (`/api/admin/quality`) | ✅ |
| M3.14 | Tự tạo đề tương tự (`POST /api/exams/similar`): học sinh tải đề thầy cô cho (ảnh, PDF, Word, chữ), OCR ảnh / PDF scan bằng Gemini | ✅ |
| M3.15 | Mô hình phân loại đề XLM-R trong app (`/api/classifier`): nhận định chủ đề / lớp / độ khó cho mọi câu tải lên, thu thập | ✅ |
| M4 | OCR ảnh/PDF scan (Mathpix/Pix2Text), lưu file trên R2, mô hình phân loại thay luật nhận dạng | chưa |

**Hạn chế hiện tại:** ảnh và PDF scan báo lỗi "cần OCR". Biến thể dạng "giữ như đề gốc" có đáp án là tập nghiệm của bất phương trình hoặc biểu thức
nhân tử thì vẫn duyệt được, nhưng chưa vào ngân hàng luyện tập (chưa chấm tự động được); chọn Trắc nghiệm hoặc Trả lời ngắn để luyện tập.
