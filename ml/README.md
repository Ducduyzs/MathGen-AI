# Dữ liệu huấn luyện — MathGen AI

Dữ liệu cho hai hướng chạy song song:

- **(A) Phân loại:** đoán chủ đề, cấp lớp, độ khó của một đề toán. Thay thế bước nhận dạng bằng từ khóa trong pipeline.
- **(B) Sinh biến thể:** cho đề gốc, sinh đề mới cùng dạng, trả về JSON. Mọi đầu ra vẫn phải qua bộ kiểm chứng của pipeline.

Số liệu chi tiết của lần chạy gần nhất: [DATA_REPORT.md](DATA_REPORT.md) (chỉ nguồn sạch) và [DATA_REPORT_with_flagged.md](DATA_REPORT_with_flagged.md) (thí nghiệm nội bộ).

## Chạy lại từ đầu

```bash
cd ml
uv venv --python 3.13 .venv && uv pip install --python .venv -r requirements.txt

# 1. Tải dữ liệu công khai (~550 MB). Thêm --include-flagged để tải cả nguồn flagged
.venv/Scripts/python -X utf8 scripts/collect.py --include-flagged

# 2. Sinh dữ liệu tổng hợp tiếng Việt từ bộ sinh đề + pipeline kiểm chứng (seed cố định → tái lập được)
(cd ../apps/web && npm run ml:export -- --out ../../ml/data/raw/synthetic_vi --seed 2026 --per-template 300)

# 3. Chuẩn hóa → data/unified/{problems,pairs}.jsonl
.venv/Scripts/python -X utf8 scripts/normalize.py

# 4. Chia tập → data/splits/ (bản sạch) hoặc data/splits_with_flagged/ (thí nghiệm)
.venv/Scripts/python -X utf8 scripts/build_splits.py
.venv/Scripts/python -X utf8 scripts/build_splits.py --include-flagged

# 5. Kiểm tra rò rỉ train/val/test
.venv/Scripts/python -X utf8 scripts/check_leakage.py data/splits
```

## Nguồn dữ liệu

Giấy phép lấy từ metadata Hugging Face ngày 27/10/2026. **Kiểm tra lại trước khi phát hành sản phẩm.**

| Nguồn | Quốc gia | Ngôn ngữ | Giấy phép | Mức | Dùng cho |
|---|---|---|---|---|---|
| Dữ liệu tổng hợp của dự án (`synthetic_vi`) | VN | vi | Nội bộ | open | A + B, nhãn chính xác lớp 6–12 |
| [GSM8K](https://huggingface.co/datasets/openai/gsm8k) | US | en | MIT | open | A (toán lời văn) |
| [MetaMathQA](https://huggingface.co/datasets/meta-math/MetaMathQA) | — | en | MIT | open | B: 240 nghìn cặp diễn đạt lại / suy ngược |
| [NuminaMath-CoT](https://huggingface.co/datasets/AI-MO/NuminaMath-CoT) (1/5 bộ) | CN, quốc tế | en | Apache-2.0 | open | A: có `cn_k12` = đề phổ thông Trung Quốc |
| [AQuA-RAT](https://huggingface.co/datasets/deepmind/aqua_rat) | quốc tế | en | Apache-2.0 | open | A (trắc nghiệm) |
| [SVAMP](https://huggingface.co/datasets/ChilleD/SVAMP) | IN | en | MIT | open | A |
| [Orca-Math 200k](https://huggingface.co/datasets/microsoft/orca-math-word-problems-200k) | — | en | MIT | open | A |
| [Vietnamese Reality Math](https://huggingface.co/datasets/Mels22/Vietnamese-Intermediate-Reality-Math-Problems) | VN | vi | Apache-2.0 | open | đề thật cần gắn nhãn |
| [MATH](https://huggingface.co/datasets/EleutherAI/hendrycks_math) | US | en | MIT (khai báo) | **flagged** | nhãn chủ đề + Level 1–5 rất tốt, nhưng nguồn gốc là đề AMC/AIME và bản gốc trên HF từng bị yêu cầu gỡ |
| [VNHSGE](https://huggingface.co/datasets/roshansk23/Vietnam_HighSchool_Exam_Dataset) (lọc môn Toán) | VN | vi | "cc" không rõ loại | **flagged** | 235 câu đề tốt nghiệp THPT 2019–2023, rất quý để **đánh giá** |
| [vi_grade_school_math_mcq](https://huggingface.co/datasets/hllj/vi_grade_school_math_mcq) | VN | vi | MIT (khai báo) | **flagged** | crawl từ vietjack |
| [vi_math_problem_crawl](https://huggingface.co/datasets/hllj/vi_math_problem_crawl) | VN | vi | MIT (khai báo) | **flagged** | crawl lời giải SGK từ tech12h |

- **open:** dùng để train.
- **flagged:** người đăng ghi giấy phép mở, nhưng nội dung có vấn đề về nguồn gốc. **Chỉ dùng cho thí nghiệm nội bộ, không đưa vào dữ liệu hay mô hình phát hành.**

**Đã cân nhắc nhưng không dùng:**
- MathQA: chỉ có script tải riêng, không có parquet.
- toanmath.com-alpha: 312 GB ảnh/PDF, nội dung crawl.
- Các bản dịch máy của 5CD-AI: không ghi giấy phép.
- DeepMind math_dataset: thẻ dữ liệu không ghi giấy phép.

## Định dạng

`data/unified/problems.jsonl` có một đề mỗi dòng:

```json
{"id": "...", "source": "gsm8k", "license": "MIT", "tier": "open", "lang": "en", "text": "...",
 "answer": "18", "solution": "...", "choices": null,
 "labels": {"topic": "arithmetic", "grade": null, "grade_band": null, "difficulty": 0.3, "qtype": "free", "style": "word_problem"},
 "label_src": {"topic": "weak", "grade_band": null, "difficulty": "heur"},
 "key": "…", "group": "…"}
```

**Các trường nhãn:**
- `topic` có 14 giá trị: arithmetic, algebra, functions, trigonometry, calculus, exp_log, sequences, geometry, coordinates, probability_counting, statistics, number_theory, precalculus, other.
- `grade_band`:
  - `primary` (lớp 1–5), `lower_secondary` (lớp 6–9), `upper_secondary` (lớp 10–12): cấp lớp phổ thông.
  - `school`: đề phổ thông nhưng không rõ lớp.
  - `competition`: đề thi đấu.
- `qtype`: `free` (tự do), `mcq` (trắc nghiệm), `tf` (Đúng/Sai), `short` (trả lời ngắn).

**Nguồn của từng nhãn (`label_src`), quyết định nhãn được dùng vào việc gì:**

| Giá trị | Nghĩa | Train | Chấm điểm |
|---|---|---|---|
| `exact` | Đúng theo cách dựng (dữ liệu tổng hợp) | ✔ | ✔ |
| `source` | Nhãn gốc của bộ dữ liệu | ✔ | ✔ |
| `heur` | Ước lượng theo quy tắc (ví dụ độ khó GSM8K theo số bước tính) | ✔ | ✘ |
| `weak` | Đoán bằng từ khóa | ✔ | **✘** |

Khi đánh giá phải **che theo từng trường**: chỉ chấm trường nào có `label_src` là `exact` hoặc `source`.

`data/unified/pairs.jsonl` có một cặp mỗi dòng:

```json
{"relation": "rule:doi_he_so | template:<mã> | rephrase | backward_sv | backward_fobar",
 "seed": {"text": "...", "answer": "..."}, "target": {"text": "...", "answer": "...", "solution": "..."},
 "verified": true, "group": "<khóa của đề gốc>"}
```

Ở `data/splits/generate/*.jsonl`, mỗi cặp có thêm trường `messages` (system/user/assistant). Phần assistant là JSON `{statement, answer, choices, solution}`, dùng thẳng cho SFT/LoRA.

## Chính sách chia tập

- **Chia theo nhóm, không theo dòng.** Các bản trình bày của cùng một đề (LaTeX và chữ thường), cũng như mọi biến thể của cùng một đề gốc, luôn nằm chung một tập. `check_leakage.py` xác nhận không có giao nhau.
- **Đề test chính thức** của GSM8K và AQuA-RAT chỉ có nhãn đoán nên **bị loại hẳn**, không đưa vào train. Mục đích là không làm bẩn benchmark.
- **`test_unseen_templates`:** 7/42 dạng bài tổng hợp bị giữ lại hoàn toàn khỏi train, để đo xem mô hình có nhận ra dạng chưa từng thấy hay chỉ học thuộc khuôn.
- **Cân bằng chủ đề:** mỗi chủ đề tối đa 15.000 dòng trong train, ưu tiên dòng có nhãn tin cậy.
- **`negatives.jsonl`:** biến thể bị bộ kiểm chứng loại, để dành cho DPO hoặc huấn luyện bộ chấm sau này.

## Hướng dẫn gắn nhãn `to_label_vi.jsonl` (việc của giáo viên)

Đây là đề thật tiếng Việt. Gắn nhãn xong sẽ thành **bộ test thật duy nhất**. Hiện có 499 câu ở bản sạch; bản có nguồn flagged thêm 235 câu đề tốt nghiệp THPT.

Điền vào trường `label` của mỗi dòng:

- **`topic`:** một trong 14 chủ đề ở trên.
- **`grade`:** lớp 6–12, chọn lớp mà bài này thường được dạy.
- **`difficulty_level`:**
  - 1 = Nhận biết
  - 2 = Thông hiểu
  - 3 = Vận dụng
  - 4 = Vận dụng cao
- **`kind`:** chỉ điền nếu bài thuộc 9 dạng của pipeline (`linear_equation`, `quadratic_equation`, …); nếu không thì để `null`.

Trường `suggested` là nhãn đoán để tham khảo, **không chép nguyên**. Nên để 2 người gắn nhãn độc lập khoảng 100 câu đầu, rồi đo mức đồng thuận.

## Hạn chế cần biết

- **Nhãn lớp cụ thể** hiện chỉ có ở dữ liệu tổng hợp (khoảng 11 nghìn câu). Đề thật có nhãn lớp phải chờ bước gắn nhãn ở trên.
- **Phần lớn đề quốc tế là tiếng Anh.** Nếu fine-tune PhoBERT (chỉ hiểu tiếng Việt) thì chỉ dùng được phần tiếng Việt. Muốn tận dụng toàn bộ thì nên chọn **bộ mã hóa đa ngữ** (XLM-R, mDeBERTa), hoặc dịch dữ liệu (cần kiểm tra giấy phép bản dịch).
- **Nhãn chủ đề yếu** đoán bằng từ khóa có sai số. Nhãn này chỉ dùng để train, không dùng để báo cáo kết quả.
- **Dữ liệu tổng hợp** lặp khuôn câu chữ. Mô hình học trên đó dễ đạt điểm cao trên `test` nhưng kém trên `test_unseen_templates` và đề thật. Hãy báo cáo cả ba con số.
- **NuminaMath** mới tải 1/5 bộ. Muốn tải đủ thì sửa `max_files` trong `scripts/sources.py`.
