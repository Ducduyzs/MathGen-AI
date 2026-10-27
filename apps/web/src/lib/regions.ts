// 34 tỉnh/thành từ 1/7/2025 (cùng mã với apps/api/app/modules/regions/data.py).
export const PROVINCES: { code: string; name: string }[] = [
  { code: "ha-noi", name: "Hà Nội" }, { code: "hue", name: "Huế" }, { code: "hai-phong", name: "Hải Phòng" },
  { code: "da-nang", name: "Đà Nẵng" }, { code: "ho-chi-minh", name: "TP. Hồ Chí Minh" }, { code: "can-tho", name: "Cần Thơ" },
  { code: "tuyen-quang", name: "Tuyên Quang" }, { code: "cao-bang", name: "Cao Bằng" }, { code: "lai-chau", name: "Lai Châu" },
  { code: "lao-cai", name: "Lào Cai" }, { code: "thai-nguyen", name: "Thái Nguyên" }, { code: "dien-bien", name: "Điện Biên" },
  { code: "lang-son", name: "Lạng Sơn" }, { code: "son-la", name: "Sơn La" }, { code: "phu-tho", name: "Phú Thọ" },
  { code: "bac-ninh", name: "Bắc Ninh" }, { code: "quang-ninh", name: "Quảng Ninh" }, { code: "hung-yen", name: "Hưng Yên" },
  { code: "ninh-binh", name: "Ninh Bình" }, { code: "thanh-hoa", name: "Thanh Hóa" }, { code: "nghe-an", name: "Nghệ An" },
  { code: "ha-tinh", name: "Hà Tĩnh" }, { code: "quang-tri", name: "Quảng Trị" }, { code: "quang-ngai", name: "Quảng Ngãi" },
  { code: "gia-lai", name: "Gia Lai" }, { code: "khanh-hoa", name: "Khánh Hòa" }, { code: "lam-dong", name: "Lâm Đồng" },
  { code: "dak-lak", name: "Đắk Lắk" }, { code: "dong-nai", name: "Đồng Nai" }, { code: "tay-ninh", name: "Tây Ninh" },
  { code: "vinh-long", name: "Vĩnh Long" }, { code: "dong-thap", name: "Đồng Tháp" }, { code: "ca-mau", name: "Cà Mau" },
  { code: "an-giang", name: "An Giang" },
];

export const provinceName = (code: string | null | undefined) => PROVINCES.find((p) => p.code === code)?.name;

/** Sắp theo tên cho ô chọn (thành phố trực thuộc trung ương vẫn nằm trong danh sách chung). */
export const PROVINCES_SORTED = [...PROVINCES].sort((a, b) => a.name.replace("TP. ", "").localeCompare(b.name.replace("TP. ", ""), "vi"));
