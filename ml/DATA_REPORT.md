# Báo cáo dữ liệu huấn luyện

Tạo bởi `scripts/build_splits.py` → `data/splits/` · nguồn flagged: **không** · giới hạn mỗi nguồn: 40000 · mỗi chủ đề (train): 15000 · cặp MetaMathQA: 60000

## Phân loại (dạng bài / chủ đề, lớp, độ khó)

Dạng bài tổng hợp giữ lại khỏi train (7/42): quad_double_root, tf_linear_function, thpt_extremum, thpt_integral_cubic, thpt_monotonic, thpt_probability_classic, vertex_choice

Bỏ đề test/validation chính thức chỉ có nhãn đoán (tránh làm bẩn benchmark): gsm8k 1319, aqua_rat 254. Cắt bớt do giới hạn 15000 dòng/chủ đề: 57838 dòng.

| Nguồn | train | val | test | test_unseen_templates |
|---|---:|---:|---:|---:|
| aqua_rat | 15938 | 0 | 0 | 0 |
| gsm8k | 1643 | 0 | 0 | 0 |
| numina_cot | 35787 | 2171 | 2042 | 0 |
| orca_math | 12055 | 0 | 0 | 0 |
| svamp | 584 | 40 | 321 | 0 |
| synthetic_vi | 10947 | 752 | 746 | 1033 |
| vi_reality | 63 | 0 | 0 | 0 |
| **Tổng** | **77017** | **2963** | **3109** | **1033** |

Độ phủ nhãn trong train (tỉ lệ dòng có nhãn · nguồn nhãn):

- `topic`: 82% · weak 51959, exact 10947, source 584
- `grade_band`: 54% · source 30723, exact 10947
- `difficulty`: 17% · exact 10947, heur 2227
- `grade` (lớp cụ thể): 10947 dòng

Phân bố chủ đề (train): arithmetic 15000, geometry 9799, algebra 9453, number_theory 6667, probability_counting 5484, functions 3551, sequences 3331, coordinates 3271, calculus 2537, trigonometry 2035, statistics 1347, exp_log 1015

Đề thật tiếng Việt cần gắn nhãn: **499** câu (`to_label_vi.jsonl`).

## Sinh biến thể (cặp đề gốc → biến thể)

| Nguồn | Quan hệ | train | val | test |
|---|---|---:|---:|---:|
| metamathqa | backward_fobar | 12176 | 754 | 742 |
| metamathqa | backward_sv | 12133 | 682 | 646 |
| metamathqa | rephrase | 29546 | 1746 | 1575 |
| synthetic_vi | rule: | 1061 | 56 | 54 |
| synthetic_vi | template: | 5675 | 331 | 294 |

Ví dụ âm (bị bộ kiểm chứng loại): **19** cặp (`negatives.jsonl`).

