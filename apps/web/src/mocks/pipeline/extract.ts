// Trích văn bản từ file tải lên. Mock dùng thư viện Node chạy trong route API;
// backend Python: PyMuPDF (PDF), python-docx/Pandoc (Word), Mathpix/Pix2Text (ảnh → LaTeX).

export class ExtractError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt", "tex", "md", "png", "jpg", "jpeg"];

export async function extractText(file: { name: string; bytes: Uint8Array }): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["txt", "tex", "md"].includes(ext)) return new TextDecoder("utf-8").decode(file.bytes);

  if (ext === "docx") {
    const mod = await import("mammoth");
    const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(file.bytes) });
    return value;
  }

  if (ext === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
    const { text } = await pdfText(pdf, { mergePages: true });
    if (!text.trim()) throw new ExtractError("ocr_required", "PDF không có lớp chữ (bản scan) — cần OCR.");
    return text;
  }

  if (["png", "jpg", "jpeg"].includes(ext)) {
    throw new ExtractError("ocr_required", "Ảnh đề thi cần OCR công thức (Mathpix/Pix2Text) — chỉ có ở backend.");
  }
  throw new ExtractError("unsupported_file", "Định dạng file chưa được hỗ trợ.");
}
