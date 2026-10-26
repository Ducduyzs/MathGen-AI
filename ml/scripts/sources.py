"""Danh mục nguồn dữ liệu toán công khai (nhiều quốc gia) cho hai hướng:
  (A) phân loại dạng bài / lớp / độ khó,  (B) sinh biến thể (cặp đề gốc → đề biến thể).

tier:
  open    — giấy phép cho phép, rõ nguồn gốc: được dùng để train.
  flagged — người đăng ghi giấy phép mở nhưng nội dung có vấn đề nguồn gốc (crawl từ trang thương mại,
            đề thi từng bị yêu cầu gỡ, giấy phép mơ hồ). Mặc định KHÔNG tải; chỉ dùng thí nghiệm nội bộ,
            không đưa vào dữ liệu sản phẩm.
Giấy phép lấy từ metadata Hugging Face (cardData.license) ngày 27/10/2026 — kiểm tra lại trước khi phát hành.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Source:
    name: str
    repo: str
    license: str
    tier: str  # "open" | "flagged"
    lang: str
    country: str
    note: str
    configs: tuple[str, ...] = ()  # rỗng = mọi config
    splits: tuple[str, ...] = ("train", "test")
    max_files: int | None = None  # giới hạn số file parquet tải về (bộ rất lớn)
    tags: tuple[str, ...] = field(default=())


SOURCES: list[Source] = [
    Source("gsm8k", "openai/gsm8k", "MIT", "open", "en", "US",
           "8,8 nghìn bài toán lời văn cấp tiểu học–THCS, lời giải từng bước.", configs=("main",)),
    Source("metamathqa", "meta-math/MetaMathQA", "MIT", "open", "en", "—",
           "395 nghìn câu tăng cường từ GSM8K/MATH: diễn đạt lại, suy ngược (FOBAR, SV) → cặp đề gốc → biến thể.",
           splits=("train",)),
    Source("numina_cot", "AI-MO/NuminaMath-CoT", "Apache-2.0", "open", "en", "CN/US/quốc tế",
           "860 nghìn bài có lời giải; trường source gồm cn_k12 (đề phổ thông Trung Quốc), olympiads, amc_aime…",
           splits=("train",), max_files=1),
    Source("aqua_rat", "deepmind/aqua_rat", "Apache-2.0", "open", "en", "quốc tế",
           "~100 nghìn câu trắc nghiệm 5 phương án (đại số lời văn) kèm lời giải.", configs=("raw",)),
    Source("svamp", "ChilleD/SVAMP", "MIT", "open", "en", "IN",
           "1 nghìn biến thể có chủ đích của bài toán lời văn (đổi câu hỏi, đổi thứ tự…).", splits=("train", "test")),
    Source("orca_math", "microsoft/orca-math-word-problems-200k", "MIT", "open", "en", "—",
           "200 nghìn bài lời văn tổng hợp kèm lời giải.", splits=("train",)),
    Source("vi_reality", "Mels22/Vietnamese-Intermediate-Reality-Math-Problems", "Apache-2.0", "open", "vi", "VN",
           "~500 bài toán thực tế tiếng Việt (THCS) kèm lời giải.", splits=("train",)),
    # ---- flagged: chỉ dùng thí nghiệm nội bộ
    Source("hendrycks_math", "EleutherAI/hendrycks_math", "MIT (khai báo)", "flagged", "en", "US",
           "12,5 nghìn bài thi đấu AMC/AIME có nhãn chủ đề + Level 1–5. Bản gốc trên HF từng nhận yêu cầu gỡ (DMCA).",
           tags=("provenance",)),
    Source("vnhsge", "roshansk23/Vietnam_HighSchool_Exam_Dataset", "cc (không rõ loại)", "flagged", "vi", "VN",
           "Đề thi THPT Quốc gia nhiều môn (lọc lấy Toán). Giấy phép không rõ biến thể CC.", splits=("train",),
           tags=("license_unclear",)),
    Source("vi_mcq_grade1_5", "hllj/vi_grade_school_math_mcq", "MIT (khai báo)", "flagged", "vi", "VN",
           "Trắc nghiệm lớp 1–5, crawl từ vietjack (nội dung có bản quyền).", splits=("train",), tags=("crawled",)),
    Source("vi_crawl", "hllj/vi_math_problem_crawl", "MIT (khai báo)", "flagged", "vi", "VN",
           "Lời giải SGK crawl từ tech12h (nội dung có bản quyền).", splits=("train",), tags=("crawled",)),
]

BY_NAME = {s.name: s for s in SOURCES}
