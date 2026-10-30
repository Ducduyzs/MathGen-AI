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
  duplicate_problem: "Bài này trùng với một bài đã có trong ngân hàng (cùng dạng chuẩn). Hãy từ chối bài.",
  class_not_found: "Không tìm thấy lớp với mã này. Kiểm tra lại mã giáo viên gửi.",
  assignment_closed: "Bài tập đã hết hạn nộp.",
  due_in_past: "Hạn nộp phải ở sau thời điểm hiện tại.",
  set_empty: "Bộ đề chưa có câu nào. Thêm câu trước khi giao.",
  set_too_large: "Bộ đề tối đa 100 câu.",
  run_over: "Lượt đấu đã hết giờ.",
  room_full: "Bàn đã đủ 4 người.",
  account_disabled: "Tài khoản đã bị quản trị viên khóa. Liên hệ nhà trường để được mở lại.",
  cannot_modify_self: "Không thể tự đổi vai trò hoặc tự khóa tài khoản của chính mình.",
  last_admin: "Phải còn ít nhất một quản trị viên đang hoạt động.",
  grade_required: "Học sinh cần có lớp.",
  unknown_province: "Tỉnh/thành không hợp lệ.",
  unknown_school: "Trường không thuộc tỉnh đã chọn.",
  no_similar: "Chưa nhận ra câu nào thuộc dạng hệ thống sinh được (hiện hỗ trợ phương trình, bất phương trình, phân tích đa thức, hàm số…).",
  source_not_ready: "Đề vẫn đang được phân tích. Đợi vài giây rồi thử lại.",
  mock_unsupported: "Chế độ mock chưa hỗ trợ tính năng này. Hãy chạy với backend thật.",
  crawl_one_domain: "Các trang bắt đầu phải cùng một tên miền (mỗi nguồn một tên miền).",
  crawl_out_of_scope: "Trang bắt đầu phải nằm trong các thư mục được phép thu thập.",
  crawl_private_host: "Tên miền không phải địa chỉ công cộng (hoặc không phân giải được).",
  crawl_paused: "Nguồn đang tạm dừng. Bật lại để thu thập.",
  crawl_running: "Nguồn đang có một lượt thu thập chạy.",
  room_started: "Bàn này đã bắt đầu chơi, không vào thêm được.",
  eliminated: "Bạn đã bị loại ở ván này.",
  stale_question: "Câu này đã được chấm. Đang tải câu tiếp theo.",
  link_code_invalid: "Mã liên kết không đúng hoặc đã hết hạn. Nhờ con tạo mã mới.",
  too_many_links: "Đã đạt số tài khoản liên kết tối đa.",
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
