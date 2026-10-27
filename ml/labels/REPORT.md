# Gắn nhãn đề thật tiếng Việt bằng LLM

Nguồn: `data/splits/classify/to_label_vi.jsonl` (499 câu, Vietnamese Reality Math, Apache-2.0). Đã gộp: **499** câu. Mô hình: gpt = `gpt-5.2` (499 câu); deepseek = `deepseek-v4-pro` (499 câu); gemini = `gemini-2.5-flash` (237 câu), `gemini-3.1-flash-lite` (152 câu), `gemini-3.5-flash` (70 câu), `gemini-3-flash-preview` (40 câu).

Ba mô hình gắn nhãn độc lập với cùng một hướng dẫn (`scripts/llm_label.py`). Nhãn gộp: chủ đề và dạng lấy theo đa số (≥ 2/3), lớp và mức độ lấy trung vị. Câu đã duyệt trong `labels/reviewed.jsonl` lấy nhãn chuẩn (`label_src = "human"`).

## Mức đồng thuận

| Nhãn | Cả 3 trùng | Ít nhất 2 trùng | Fleiss' κ |
|---|---|---|---|
| topic | 61.5% | 98.2% | 0.62 |
| grade | 37.1% | 85.6% | 0.36 |
| difficulty_level | 47.9% | 99.2% | 0.36 |
| kind | 83.8% | 99.0% | 0.49 |

**Từng cặp mô hình** (tỉ lệ trùng nhãn chủ đề / lớp / mức độ):

| Cặp | topic | grade | difficulty_level |
|---|---|---|---|
| gpt – deepseek | 70.1% | 55.5% | 59.3% |
| gpt – gemini | 74.3% | 50.5% | 73.9% |
| deepseek – gemini | 76.8% | 53.7% | 61.7% |

## Kết quả

- **Đồng thuận cao** (cả 3 trùng chủ đề, lệch ≤ 1 lớp và ≤ 1 mức độ): **280** câu (56.1%).
- **Bất đồng cần duyệt** (`needs_review` ban đầu): **132** câu (đã duyệt: **132**, còn lại: **0**).
- **Đã duyệt tổng cộng** (`labels/reviewed.jsonl`): **182** câu (132 câu bất đồng + 50 câu đồng thuận lấy ngẫu nhiên).
- **Đủ điều kiện làm bộ test thật** (`unanimous` hoặc đã duyệt): **412** câu (82.6%).

**Phân bố chủ đề (nhãn sau duyệt):**

| Chủ đề | Số câu |
|---|---|
| arithmetic | 255 |
| algebra | 106 |
| functions | 81 |
| probability_counting | 15 |
| statistics | 11 |
| geometry | 8 |
| sequences | 7 |
| number_theory | 5 |
| exp_log | 5 |
| trigonometry | 4 |
| coordinates | 1 |
| other | 1 |

**Phân bố lớp:** lớp 6: 227, lớp 7: 55, lớp 8: 144, lớp 9: 43, lớp 10: 17, lớp 11: 13

**Phân bố mức độ:** mức 1: 67, mức 2: 329, mức 3: 103

**Dạng của pipeline (kind):** function_value: 35, linear_equation: 20, quadratic_equation: 6, quadratic_inequality: 2, min_value: 1

## Duyệt nhãn & ước lượng tỉ lệ sai của LLM

| Nhóm duyệt | Số câu | Đúng `topic` | Đúng `grade` (lệch ≤ 1) | Đúng `difficulty_level` (lệch ≤ 1) | Đúng `kind` | Đạt chuẩn (đúng `topic`+`kind`, lệch ≤ 1 lớp & mức) |
|---|---:|---|---|---|---|---|
| Đồng thuận cao (mẫu ngẫu nhiên) | 50 | 96.0% | 92.0% (96.0%) | 70.0% (100.0%) | 94.0% | 90.0% |
| Cần duyệt (`needs_review`) | 132 | 70.5% | 59.8% (76.5%) | 71.2% (100.0%) | 97.0% | 58.3% |

**Độ chính xác của từng mô hình trên 2 nhóm đã duyệt:**

| Mô hình | Đồng thuận (50 câu): `topic` / `grade` (≤1) / `level` / `kind` | Bất đồng (132 câu): `topic` / `grade` (≤1) / `level` / `kind` |
|---|---|---|
| gpt | 96.0% / 76.0% (96.0%) / 66.0% / 96.0% | 55.3% / 29.5% (50.8%) / 82.6% / 89.4% |
| deepseek | 96.0% / 88.0% (96.0%) / 48.0% / 90.0% | 74.2% / 64.4% (80.3%) / 56.1% / 96.2% |
| gemini | 96.0% / 76.0% (96.0%) / 68.0% / 96.0% | 57.6% / 32.6% (62.9%) / 56.1% / 93.2% |

**Nhận xét từ kết quả duyệt:**
- **Trên nhóm đồng thuận cao (`unanimous`, 50 câu lấy ngẫu nhiên với `seed = 2026`):**
  - **Chủ đề (`topic`)** sai **4.0%** (2/50 câu: `085532612700fe6f`, `861a9f5be0ecea3f`). Cả 3 LLM đều bị đánh lừa bởi khuôn câu chữ (bài toán hai giá sách chuyển qua lại bằng nhau, hoặc cân nặng cha mẹ con) nên cùng gán `algebra` lớp 8, dù bài toán giải trực tiếp bằng 2 phép tính số học lớp 6 (Tổng–Hiệu / Tổng–Tỉ).
  - **Lớp (`grade`)** sai tuyệt đối **8.0%** (4/50 câu), nhưng nếu tính **lệch ≤ 1 lớp thì chỉ sai 4.0%** (2/50 câu, chính là 2 câu sai chủ đề ở trên; 2 câu còn lại lệch 1 lớp giữa lớp 6 và lớp 7 ở bài toán nồng độ phần trăm và đại lượng tỉ lệ nghịch). Lấy trung vị 3 mô hình giúp độ chính xác lớp đạt 92.0%, cao hơn từng mô hình riêng lẻ (GPT 76%, DeepSeek 88%, Gemini 76%).
  - **Dạng cấu trúc (`kind`)** sai **6.0%** (3/50 câu: `86f1a9a3f5e8e085`, `ce78cb608b89bc9c`, `b277df1981452a16`): bài toán lời văn có nêu công thức nhưng phải tự thay số lập phương trình (lẽ ra `kind = null`), các LLM lại gắn `quadratic_equation` hoặc `linear_equation`.
  - **Mức độ (`difficulty_level`)** lệch 1 bậc ở **30.0%** (15/50 câu), nhưng **100% nằm trong phạm vi ±1 bậc** (chủ yếu do LLM nâng từ Nhận biết lên Thông hiểu hoặc từ Thông hiểu lên Vận dụng khi đề có lời văn thực tế).
  - **Tổng hợp theo tiêu chuẩn kiểm định** (đúng `topic` & `kind`, lệch ≤ 1 lớp và ≤ 1 mức độ): nhãn `unanimous` đúng **90.0%** (sai **10.0%**).
- **Trên nhóm bất đồng (`needs_review`, 132 câu):**
  - Đã giải quyết toàn bộ 9 câu không có đa số chủ đề (`topic = null`) và chuẩn hóa nhất quán theo nhóm bài cùng khuôn.
  - Nhãn gộp đa số/trung vị trước khi duyệt sai **29.5%** về `topic` (39/132 câu) và **40.2%** về `grade` (53/132 câu). Nguyên nhân chính: GPT và Gemini thường gán `algebra` lớp 8 cho bài toán số học lớp 6 có lời văn dài (đếm bậc cầu thang, tổng–tỉ cân nặng gia đình, vận tốc thay đổi từng giờ) hoặc gán lớp 6–7 cho bài toán biểu đồ Venn / quy tắc nhân thuộc chương trình lớp 10 GDPT 2018; trong khi DeepSeek bám sát chương trình lớp 6/10 hơn (đúng `topic` 74.2%, đúng lớp ±1 đạt 80.3%) nhưng lại hay đẩy `difficulty_level` cao hơn 1 bậc.
