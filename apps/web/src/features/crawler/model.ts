import type { CrawlJobStatus, CrawlLicense, CrawlPageResult } from "@/types/api";

type Tone = "brand" | "neutral" | "success" | "warning" | "danger";

export const LICENSE_OPTIONS: { value: CrawlLicense; label: string; hint: string }[] = [
  { value: "government", label: "Đề thi / văn bản của cơ quan nhà nước", hint: "Đề thi chính thức do Bộ, Sở GD&ĐT công bố công khai." },
  { value: "cc0", label: "CC0", hint: "Tác giả từ bỏ mọi quyền." },
  { value: "cc_by", label: "CC BY", hint: "Được dùng lại, phải ghi nguồn (hệ thống tự ghi URL)." },
  { value: "cc_by_sa", label: "CC BY-SA", hint: "Được dùng lại, ghi nguồn và chia sẻ cùng giấy phép." },
  { value: "public_domain", label: "Phạm vi công cộng", hint: "Tác phẩm đã hết thời hạn bảo hộ." },
  { value: "permission", label: "Có văn bản cho phép", hint: "Chủ sở hữu đồng ý bằng văn bản / email. Bắt buộc ghi bằng chứng." },
];

export const JOB_STATUS: Record<CrawlJobStatus, { label: string; tone: Tone }> = {
  queued: { label: "Đang chờ", tone: "neutral" },
  running: { label: "Đang thu thập", tone: "brand" },
  done: { label: "Xong", tone: "success" },
  failed: { label: "Lỗi", tone: "danger" },
  cancelled: { label: "Đã dừng", tone: "warning" },
};

export const PAGE_STATUS: Record<CrawlPageResult["status"], { label: string; tone: Tone }> = {
  fetched: { label: "Có câu hỏi", tone: "success" },
  unchanged: { label: "Không đổi", tone: "neutral" },
  no_questions: { label: "Không có câu", tone: "neutral" },
  blocked: { label: "Bị chặn", tone: "warning" },
  error: { label: "Lỗi", tone: "danger" },
};

export const isBusy = (s?: CrawlJobStatus) => s === "queued" || s === "running";

/** Mỗi dòng một mục, bỏ dòng trống. */
export const lines = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
