"""34 đơn vị hành chính cấp tỉnh từ 1/7/2025 (Nghị quyết 202/2025/QH15) và tên tỉnh cũ → tỉnh mới.

Đề thi trước 2025 thường ghi tên tỉnh cũ ("Sở GD&ĐT Bình Dương"): vẫn xếp vào tỉnh mới, giữ tên gốc để hiển thị.
"""

PROVINCES: list[tuple[str, str]] = [
    # 6 thành phố trực thuộc trung ương
    ("ha-noi", "Hà Nội"), ("hue", "Huế"), ("hai-phong", "Hải Phòng"), ("da-nang", "Đà Nẵng"), ("ho-chi-minh", "TP. Hồ Chí Minh"),
    ("can-tho", "Cần Thơ"),
    # 28 tỉnh
    ("tuyen-quang", "Tuyên Quang"), ("cao-bang", "Cao Bằng"), ("lai-chau", "Lai Châu"), ("lao-cai", "Lào Cai"),
    ("thai-nguyen", "Thái Nguyên"), ("dien-bien", "Điện Biên"), ("lang-son", "Lạng Sơn"), ("son-la", "Sơn La"),
    ("phu-tho", "Phú Thọ"), ("bac-ninh", "Bắc Ninh"), ("quang-ninh", "Quảng Ninh"), ("hung-yen", "Hưng Yên"),
    ("ninh-binh", "Ninh Bình"), ("thanh-hoa", "Thanh Hóa"), ("nghe-an", "Nghệ An"), ("ha-tinh", "Hà Tĩnh"),
    ("quang-tri", "Quảng Trị"), ("quang-ngai", "Quảng Ngãi"), ("gia-lai", "Gia Lai"), ("khanh-hoa", "Khánh Hòa"),
    ("lam-dong", "Lâm Đồng"), ("dak-lak", "Đắk Lắk"), ("dong-nai", "Đồng Nai"), ("tay-ninh", "Tây Ninh"),
    ("vinh-long", "Vĩnh Long"), ("dong-thap", "Đồng Tháp"), ("ca-mau", "Cà Mau"), ("an-giang", "An Giang"),
]
NAMES = dict(PROVINCES)

# Tỉnh cũ đã sáp nhập → mã tỉnh mới. Khóa đã bỏ dấu, chữ thường.
LEGACY: dict[str, str] = {
    "ha giang": "tuyen-quang", "yen bai": "lao-cai", "bac kan": "thai-nguyen", "vinh phuc": "phu-tho", "hoa binh": "phu-tho",
    "bac giang": "bac-ninh", "thai binh": "hung-yen", "hai duong": "hai-phong", "ha nam": "ninh-binh", "nam dinh": "ninh-binh",
    "quang binh": "quang-tri", "thua thien hue": "hue", "thua thien - hue": "hue", "quang nam": "da-nang", "kon tum": "quang-ngai",
    "binh dinh": "gia-lai", "ninh thuan": "khanh-hoa", "dak nong": "lam-dong", "binh thuan": "lam-dong", "phu yen": "dak-lak",
    "binh phuoc": "dong-nai", "long an": "tay-ninh", "ben tre": "vinh-long", "tra vinh": "vinh-long", "tien giang": "dong-thap",
    "bac lieu": "ca-mau", "kien giang": "an-giang", "soc trang": "can-tho", "hau giang": "can-tho", "binh duong": "ho-chi-minh",
    "ba ria - vung tau": "ho-chi-minh", "ba ria vung tau": "ho-chi-minh", "ba ria-vung tau": "ho-chi-minh", "vung tau": "ho-chi-minh",
}
# Cách viết khác của tỉnh hiện hành
VARIANTS: dict[str, str] = {
    "tp hcm": "ho-chi-minh", "tp.hcm": "ho-chi-minh", "tphcm": "ho-chi-minh", "tp ho chi minh": "ho-chi-minh",
    "thanh pho ho chi minh": "ho-chi-minh", "ho chi minh": "ho-chi-minh", "sai gon": "ho-chi-minh", "ha noi": "ha-noi",
    "dak lak": "dak-lak", "daklak": "dak-lak", "khanh hoa": "khanh-hoa", "thanh hoa": "thanh-hoa",
}
ALIASES: dict[str, str] = {**LEGACY, **VARIANTS}

EXAM_KINDS: dict[str, str] = {
    "mid_term": "Giữa học kì",
    "end_term": "Cuối học kì",
    "grade10": "Tuyển sinh lớp 10",
    "graduation": "Tốt nghiệp THPT",
    "gifted": "Học sinh giỏi",
    "survey": "Khảo sát / thi thử",
}

SCHOOL_LEVELS: dict[str, str] = {"primary": "Tiểu học", "lower": "THCS", "upper": "THPT", "multi": "Liên cấp"}
