# Lần chạy thí nghiệm 27/10/2026

**Máy:** vast.ai, 2 × RTX 3090 24 GB, PyTorch 2.14 (CUDA 13.0), transformers 5.21, peft 0.21. Hai job chạy song song, mỗi job một GPU.

**Dữ liệu:** `data/splits/`, bản sạch, không có nguồn flagged. Xem [../../DATA_REPORT.md](../../DATA_REPORT.md).

## (A) Phân loại: XLM-R base, đa nhiệm, 3 epoch, 14,4 phút

Chỉ chấm trên nhãn tin cậy (`exact`/`source`). Mốc so sánh là cách đoán chủ đề bằng từ khóa mà pipeline đang dùng.

| Tập | Chủ đề (acc / macro-F1) | Mốc từ khóa | Cấp lớp | Lớp cụ thể | Độ khó (MAE / Spearman) |
|---|---|---|---|---|---|
| val | 1,00 / 1,00 | 0,84 | 0,985 | 1,00 | 0,027 / 0,98 |
| test | 1,00 / 1,00 | 0,63 | 0,983 | 1,00 | 0,027 / 0,97 |
| **test_unseen_templates** (7 dạng chưa từng thấy) | **0,41 / 0,46** | 0,21 | 0,43 | 0,41 | 0,153 / **−0,26** |

**Đánh giá:**
- Trên tập test, các nhãn chấm được chủ yếu là **đề tổng hợp cùng khuôn với train** (cộng một ít SVAMP), nên 100% chỉ có nghĩa là mô hình **thuộc khuôn câu chữ**.
- Gặp dạng bài mới, chủ đề chỉ đúng 41% (vẫn hơn cách dùng từ khóa, 21%). Độ khó còn tương quan **âm**.
- Kết luận: **chưa dùng được cho đề thật.**

**Việc cần làm tiếp:**
1. Gắn nhãn `to_label_vi.jsonl` (đề thật) để có bộ test thật.
2. Đa dạng hóa câu chữ của dữ liệu tổng hợp: nhiều cách hỏi cho cùng một dạng, trộn lời văn.
3. Giảm tỷ trọng đề tổng hợp, tăng đề thật trong train.
4. Báo cáo đồng thời ba con số: test, dạng chưa thấy, và đề thật.

## (B) Sinh: Qwen2.5-1.5B-Instruct + LoRA r=16, 1 epoch, 38,8 phút

- **Dữ liệu train:** 33.452 ví dụ, khoảng 6,8 triệu token. Gồm 6.736 cặp tiếng Việt nhân đôi và 20.000 cặp MetaMathQA.
- **Tốc độ:** khoảng 2.950 token/giây.
- **Val loss:** 0,849 trước khi train, 0,098 sau khi train.

Sinh 300 mẫu tiếng Việt và 60 mẫu tiếng Anh trên đề gốc của tập test, rồi chấm bằng `npm run ml:verify` (pipeline của dự án). Kết quả đầy đủ: `out/generator/verify_report.json`.

| Chỉ số (tiếng Việt) | Mô hình | Trần: đáp án mẫu |
|---|---|---|
| JSON hợp lệ | 100% | 100% |
| Trong phạm vi bộ kiểm chứng | 43% (130/300) | 40% |
| Nhận dạng được (trong phạm vi) | 100% | 100% |
| **Đáp án mô hình tự đưa ra đúng** | **65,3%** | 98,3% |
| **Đề hoàn toàn hợp lệ** (đúng, cùng dạng, mới, không trùng ngân hàng) | **53,8%** | 92,6% |

**Lỗi hay gặp:**
- **Tính sai** đáp án, nhất là phương trình chứa phân số và câu hỏi "số nguyên nhỏ nhất".
- **Sinh đề vô lý**, ví dụ hỏi giá trị nhỏ nhất của parabol có $a < 0$, hoặc bất phương trình bậc hai có nghiệm vô tỉ.
- **Trùng lặp** giữa các mẫu.

Tiếng Anh: JSON hợp lệ 100%. Chưa có bộ kiểm chứng tự động cho tiếng Anh.

**Đánh giá:** mô hình học được **khuôn đề** rất tốt nhưng **tính toán không đáng tin**, với khoảng 1/3 đáp án sai. Kết quả này khớp với thiết kế "mô hình đề xuất, bộ kiểm chứng quyết định". Có hai cách dùng tiếp:

- **Bỏ đáp án của mô hình, để bộ giải tính lại.** Khi đó số đề dùng được (nhận dạng được, giải được, không trùng) là 111/130, tức **khoảng 85%** trong phạm vi bộ kiểm chứng.
- **Giá trị thật của mô hình nằm ở những gì luật không làm được**: lời văn, bài toán thực tế. Lần chạy tiếp theo nên train trên loại dữ liệu đó, và đo độ đa dạng so với bộ sinh theo luật.

## File

- `out/classifier/`:
  - `model.pt`: trọng số, khoảng 1,1 GB, không commit.
  - `tokenizer/`
  - `metrics.json`
- `out/generator/`:
  - `adapter/`: LoRA, 82 MB, không commit.
  - `metrics.json`
  - `samples.jsonl`
  - `verify_report.json`
- `out/*.log`, `run.sh`: log và lệnh chạy trên máy GPU.
