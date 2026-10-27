# Gắn nhãn đề thật tiếng Việt bằng LLM

Nguồn: `data/splits/classify/to_label_vi.jsonl` (499 câu, Vietnamese Reality Math, Apache-2.0). Đã gộp: **499** câu. Mô hình: gpt = `gpt-5.2` (499 câu); deepseek = `deepseek-v4-pro` (499 câu); gemini = `gemini-2.5-flash` (237 câu), `gemini-3.1-flash-lite` (152 câu), `gemini-3.5-flash` (70 câu), `gemini-3-flash-preview` (40 câu).

Ba mô hình gắn nhãn độc lập với cùng một hướng dẫn (`scripts/llm_label.py`). Nhãn gộp: chủ đề và dạng lấy theo đa số (≥ 2/3), lớp và mức độ lấy trung vị.

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

- **Đồng thuận cao** (cả 3 trùng chủ đề, lệch ≤ 1 lớp và ≤ 1 mức độ): **280** câu (56.1%). Dùng làm bộ test thật tạm thời.
- **Cần giáo viên duyệt** (`needs_review`): **132** câu: chủ đề không có đa số, hoặc lớp / mức độ lệch quá 1.

**Phân bố chủ đề (nhãn gộp):**

| Chủ đề | Số câu |
|---|---|
| arithmetic | 231 |
| algebra | 121 |
| functions | 75 |
| probability_counting | 15 |
| sequences | 11 |
| statistics | 11 |
| (không có đa số) | 9 |
| geometry | 8 |
| exp_log | 8 |
| trigonometry | 4 |
| number_theory | 4 |
| coordinates | 1 |
| other | 1 |

**Phân bố lớp:** lớp 6: 193, lớp 7: 71, lớp 8: 158, lớp 9: 52, lớp 10: 11, lớp 11: 13, lớp 12: 1

**Phân bố mức độ:** mức 1: 51, mức 2: 314, mức 3: 134

**Dạng của pipeline (kind):** function_value: 33, linear_equation: 22, quadratic_equation: 7, quadratic_inequality: 2, min_value: 1

## Hạn chế

- Nhãn LLM là **nhãn bạc**, chưa phải nhãn chuẩn. Các mô hình có thể sai giống nhau (ví dụ cùng xếp lớp theo độ khó con số thay vì theo chương trình), nên đồng thuận cao không bảo đảm đúng.
- Mức độ (Nhận biết → Vận dụng cao) mang tính chủ quan; nên để giáo viên duyệt ngẫu nhiên khoảng 50 câu đồng thuận cao để ước lượng tỉ lệ sai.
