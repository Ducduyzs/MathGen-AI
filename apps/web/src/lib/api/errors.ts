const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email hoặc mật khẩu không đúng.",
  email_taken: "Email này đã được sử dụng.",
  unauthorized: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  not_found: "Không tìm thấy dữ liệu.",
  no_problem: "Chưa có bài phù hợp. Hãy thử kỹ năng khác.",
  no_template: "Chưa có dạng bài phù hợp với lựa chọn này. Hãy chọn thêm chủ đề.",
  unsupported_file: "Định dạng file chưa được hỗ trợ. Dùng PDF, Word (.docx), ảnh hoặc file văn bản.",
  file_too_large: "File vượt quá 20 MB.",
  upload_missing: "File chưa tải lên xong. Vui lòng thử lại.",
  empty_text: "Chưa có nội dung đề để phân tích.",
  validation_error: "Dữ liệu chưa hợp lệ.",
  network_error: "Không kết nối được máy chủ. Kiểm tra mạng và thử lại.",
};

const STATUS_CODES: Record<number, string> = {
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  422: "validation_error",
};

const FALLBACK = "Đã có lỗi xảy ra. Vui lòng thử lại.";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(MESSAGES[code] ?? FALLBACK);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : FALLBACK;
}

export async function toApiError(res: Response) {
  let code: string | undefined;
  try {
    code = ((await res.json()) as { code?: string }).code;
  } catch {
    // body không phải JSON
  }
  code ??= STATUS_CODES[res.status] ?? "unknown";
  return new ApiError(res.status, code);
}
