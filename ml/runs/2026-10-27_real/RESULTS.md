# Lần chạy 27/10/2026: phân loại có đề thật

**Máy:** vast.ai, 2 × RTX 3090 24 GB (đặt ở Trung Quốc: không vào được Hugging Face / PyPI, trọng số XLM-R phải tải từ máy dev
rồi đẩy lên). PyTorch 2.14, transformers 5.21. Kịch bản: [run.sh](run.sh), số liệu đầy đủ: `out/*/metrics.json`.

**Thay đổi so với [lần chạy thử](../2026-10-27_pilot/RESULTS.md):**
- 499 đề thật tiếng Việt đã gắn nhãn (`labels/vi_reality_llm.jsonl`) được chia bằng `scripts/merge_real_labels.py`:
  real_train 213 câu, real_val 78 câu, real_test 208 câu. Chỉ chấm trên nhãn tin cậy (người duyệt hoặc cả 3 LLM trùng nhau):
  real_val 65 câu, real_test 176 câu.
- `train_classifier.py`: real_train được nhân `--real-upsample` lần vào train; **chọn epoch theo real_val**
  (val tổng hợp đạt ~100% ngay epoch 1 nên không phân biệt được các epoch).

## Kết quả trên real_test (176 câu, mô hình chưa từng thấy)

| Cấu hình | Chủ đề (acc / macro-F1) | Cấp lớp | Lớp cụ thể (đúng / lệch ≤ 1) | Độ khó (MAE / Spearman) | Thời gian |
|---|---|---|---|---|---|
| Mốc từ khóa (pipeline hiện tại) | 0,04 | – | – | – | – |
| XLM-R base, **không** đề thật | 0,50 / 0,11 | 0,06 | 0,02 / 0,09 | 0,145 / 0,09 | 14 phút |
| XLM-R base, đề thật × 20 | 0,80 / 0,40 | 0,91 | 0,73 / 0,84 | 0,097 / 0,48 | 20 phút |
| XLM-R base, đề thật × 40 | 0,82 / 0,42 | 0,94 | 0,75 / 0,86 | 0,105 / 0,47 | 21 phút |
| XLM-R base, đề thật × 40, seed khác | 0,78 / 0,37 | 0,94 | 0,76 / 0,85 | 0,094 / 0,54 | 21 phút |
| **XLM-R large, đề thật × 20** | **0,84 / 0,45** | **0,94** | **0,79 / 0,90** | 0,093 / 0,48 | 47 phút |

Trên tập test tổng hợp mọi cấu hình vẫn ~100% (không bị giảm khi thêm đề thật).

## Đánh giá

- **Đề thật là yếu tố quyết định.** Chỉ 213 câu đề thật đưa chủ đề từ 50% lên ~80%, cấp lớp từ 6% lên ~94%.
  Không có đề thật, mô hình gần như đoán sai cấp lớp vì đề tổng hợp có câu chữ rất khác đề thật.
- **Độ dao động giữa các lần chạy khoảng ±2–4 điểm** (hai seed của cùng cấu hình: 0,82 và 0,78), vì real_test nhỏ.
  Nhân 20 hay 40 lần khác nhau không đáng kể.
- **Large tốt hơn base một chút** (chủ đề +2–6 điểm, lớp cụ thể +3–5 điểm) nhưng chậm hơn khoảng 3 lần khi suy luận.
- **Macro-F1 chủ đề chỉ ~0,4:** các chủ đề hiếm trong đề thật (hình học, lượng giác, mũ – logarit, dãy số) chỉ có vài câu,
  nên mô hình gần như chỉ phân biệt tốt số học / đại số / hàm số.
- **Dạng bài chưa thấy (test_unseen_templates) vẫn kém** (27–41%) và độ khó tương quan âm: thêm đề thật không sửa được
  điểm yếu của đề tổng hợp. Vẫn cần đa dạng hóa câu chữ của bộ sinh đề.

## Việc nên làm tiếp

1. Gắn nhãn thêm đề thật cho các chủ đề hiếm (mỗi chủ đề ≥ 50 câu), ưu tiên lớp 10–12.
2. Tăng real_test lên ≥ 500 câu để so sánh cấu hình đáng tin hơn.
3. Đa dạng hóa câu chữ đề tổng hợp (nhiều cách hỏi, lời văn) để cải thiện dạng chưa thấy.
4. Tích hợp vào API: dùng **base** nếu chạy trên CPU (nhanh hơn ~3 lần, kém large vài điểm), **large** nếu có GPU.
   Trọng số fp16: `out/{large_real,base_real40}/model_fp16.pt` (không commit, xem `.gitignore`).
