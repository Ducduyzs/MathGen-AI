# Báo cáo dữ liệu huấn luyện

Tạo bởi `scripts/build_splits.py` → `data/splits_with_flagged/` · nguồn flagged: **có** · giới hạn mỗi nguồn: 40000 · mỗi chủ đề (train): 15000 · cặp MetaMathQA: 60000

## Phân loại (dạng bài / chủ đề, lớp, độ khó)

Dạng bài tổng hợp giữ lại khỏi train (7/42): quad_double_root, tf_linear_function, thpt_extremum, thpt_integral_cubic, thpt_monotonic, thpt_probability_classic, vertex_choice

Bỏ đề test/validation chính thức chỉ có nhãn đoán (tránh làm bẩn benchmark): gsm8k 1319, aqua_rat 254. Cắt bớt do giới hạn 15000 dòng/chủ đề: 68902 dòng.

| Nguồn | train | val | test | test_unseen_templates |
|---|---:|---:|---:|---:|
| aqua_rat | 14877 | 0 | 0 | 0 |
| gsm8k | 1392 | 0 | 0 | 0 |
| hendrycks_math | 5254 | 335 | 5338 | 0 |
| numina_cot | 35787 | 2171 | 2042 | 0 |
| orca_math | 10826 | 0 | 0 | 0 |
| svamp | 584 | 40 | 321 | 0 |
| synthetic_vi | 10947 | 752 | 746 | 1033 |
| vi_crawl | 8854 | 537 | 500 | 0 |
| vi_mcq_grade1_5 | 3040 | 706 | 734 | 0 |
| vi_reality | 63 | 0 | 0 | 0 |
| vnhsge | 193 | 19 | 23 | 0 |
| **Tổng** | **91817** | **4560** | **9704** | **1033** |

Độ phủ nhãn trong train (tỉ lệ dòng có nhãn · nguồn nhãn):

- `topic`: 79% · weak 55697, exact 10947, source 5838
- `grade_band`: 63% · source 46588, exact 10947
- `difficulty`: 20% · exact 10947, source 5253, heur 1976
- `grade` (lớp cụ thể): 21558 dòng

Phân bố chủ đề (train): arithmetic 15000, geometry 13960, algebra 11762, number_theory 7874, probability_counting 6050, functions 3566, sequences 3459, coordinates 3300, calculus 2573, trigonometry 2038, statistics 1347, exp_log 1025, precalculus 528

Đề thật tiếng Việt cần gắn nhãn: **734** câu (`to_label_vi.jsonl`).

## Sinh biến thể (cặp đề gốc → biến thể)

| Nguồn | Quan hệ | train | val | test |
|---|---|---:|---:|---:|
| metamathqa | backward_fobar | 12176 | 754 | 742 |
| metamathqa | backward_sv | 12133 | 682 | 646 |
| metamathqa | rephrase | 29546 | 1746 | 1575 |
| synthetic_vi | rule: | 1061 | 56 | 54 |
| synthetic_vi | template: | 5675 | 331 | 294 |

Ví dụ âm (bị bộ kiểm chứng loại): **19** cặp (`negatives.jsonl`).

