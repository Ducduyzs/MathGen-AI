// Mock API cho luồng tải đề → pipeline → sinh biến thể → hàng chờ duyệt.
// Backend thật: upload-url ký sẵn của R2, task Celery `ingest` / `verify` / `generate` chạy nền.
import type {
  CreateSourceRequest, ExtractedItem, GenerateVariantsRequest, IngestionSource, IngestionSourceSummary, IngestionStep,
  IngestionStepKey, ReviewItem, SubmitVariantsRequest, UploadUrlRequest, Variant,
} from "@/types/api";
import { PROBLEMS, SKILLS } from "./data";
import { ALLOWED_EXTENSIONS, ExtractError, extractText, MAX_UPLOAD_BYTES } from "./pipeline/extract";
import { buildBankIndex, generateVariants, type PipelineItem, runPipeline } from "./pipeline";
import { KIND_SKILL } from "./pipeline/structure";

const STEPS: { key: IngestionStepKey; label: string }[] = [
  { key: "upload", label: "Tải lên" },
  { key: "extract", label: "Trích xuất văn bản" },
  { key: "split", label: "Tách câu hỏi" },
  { key: "recognize", label: "Nhận dạng dạng bài" },
  { key: "verify", label: "Giải & kiểm chứng" },
];
/** Thời gian hiển thị tối thiểu mỗi bước, để giao diện thấy được tiến trình (pipeline thật chạy lâu hơn nhiều). */
const STEP_MS = 650;

interface MockSource {
  id: string;
  user_id: string;
  name: string;
  origin: "file" | "text";
  created_at: string;
  started: number;
  /** Số bước đã xong thực sự (0–5). */
  progress: number;
  failedAt: number | null;
  error: string | null;
  items: PipelineItem[];
}

interface StoredVariant {
  variant: Variant;
  item: PipelineItem;
}

interface IngestionState {
  storage: Map<string, { name: string; type: string; bytes: Uint8Array | null }>;
  sources: Map<string, MockSource>;
  variants: Map<string, StoredVariant>;
  bank: Map<string, string> | null;
}

const g = globalThis as unknown as { __mathgenIngestion?: IngestionState };
const st = () => (g.__mathgenIngestion ??= { storage: new Map(), sources: new Map(), variants: new Map(), bank: null });
const bankIndex = () => (st().bank ??= buildBankIndex(PROBLEMS));

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (status: number, code: string, message?: string) => json({ code, message }, status);
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const strip = ({ _structure: _s, _key: _k, ...item }: PipelineItem): ExtractedItem => item;

function view(src: MockSource): IngestionSource {
  const shown = Math.min(src.progress, 1 + Math.floor((Date.now() - src.started) / STEP_MS));
  const failed = src.failedAt !== null && shown >= src.failedAt;
  const done = !failed && src.progress === STEPS.length && shown >= STEPS.length;
  const steps: IngestionStep[] = STEPS.map((s, i) => ({
    ...s,
    state: i < shown ? "done" : failed && i === src.failedAt ? "failed" : i === shown && !done ? "running" : "pending",
  }));
  const items = done ? src.items.map(strip) : [];
  return {
    id: src.id,
    name: src.name,
    origin: src.origin,
    status: failed ? "failed" : done ? "done" : "processing",
    steps,
    created_at: src.created_at,
    error: failed ? src.error : null,
    items,
    stats: {
      total: items.length,
      recognized: items.filter((i) => i.status === "recognized").length,
      duplicates: items.filter((i) => i.duplicate_of).length,
    },
  };
}

async function process(src: MockSource, input: { text?: string; file?: { name: string; bytes: Uint8Array } }) {
  try {
    const text = input.file ? await extractText(input.file) : (input.text ?? "");
    if (!text.trim()) throw new ExtractError("empty_text", "Không có nội dung để phân tích.");
    src.progress = 2;
    src.items = runPipeline(text, src.id, bankIndex(), SKILLS);
    if (!src.items.length) {
      src.failedAt = 2;
      src.error = "Không tách được câu hỏi nào. Đề cần đánh số kiểu \"Câu 1.\", \"Bài 1:\" hoặc \"1.\".";
      return;
    }
    src.progress = STEPS.length;
  } catch (e) {
    src.failedAt = 1;
    src.error = e instanceof ExtractError ? e.message : "Không trích xuất được nội dung file.";
  }
}

export interface IngestionContext {
  userId: string;
  role: string;
  pushReview: (items: ReviewItem[]) => void;
}

/** Link tải lên ký sẵn (giả lập R2): không cần đăng nhập, chỉ cần biết khóa. */
export async function handleStorageUpload(req: Request, key: string) {
  const slot = st().storage.get(key);
  if (!slot) return fail(404, "not_found");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return fail(413, "file_too_large");
  slot.bytes = bytes;
  return new Response(null, { status: 200 });
}

export async function handleIngestion(req: Request, path: string[], body: unknown, ctx: IngestionContext): Promise<Response | null> {
  const route = `${req.method} /${path.join("/")}`;
  if (!route.includes("/ingestion") && !route.includes("/generation")) return null;
  if (ctx.role === "student") return fail(403, "forbidden");
  const s = st();

  if (route === "POST /ingestion/upload-url") {
    const b = body as UploadUrlRequest | null;
    const ext = b?.filename?.split(".").pop()?.toLowerCase() ?? "";
    if (!b || !ALLOWED_EXTENSIONS.includes(ext)) return fail(422, "unsupported_file");
    if (b.size > MAX_UPLOAD_BYTES) return fail(413, "file_too_large");
    const key = newId("f");
    s.storage.set(key, { name: b.filename, type: b.content_type, bytes: null });
    return json({ upload_url: `/api/storage/${key}`, file_key: key });
  }

  if (route === "POST /ingestion/sources") {
    const b = body as CreateSourceRequest | null;
    const file = b?.file_key ? s.storage.get(b.file_key) : undefined;
    if (b?.file_key && !file?.bytes) return fail(422, "upload_missing");
    if (!file && !b?.text?.trim()) return fail(422, "empty_text");
    const src: MockSource = {
      id: newId("src"),
      user_id: ctx.userId,
      name: b?.name?.trim() || file?.name || "Nội dung dán vào",
      origin: file ? "file" : "text",
      created_at: new Date().toISOString(),
      started: Date.now(),
      progress: 1,
      failedAt: null,
      error: null,
      items: [],
    };
    s.sources.set(src.id, src);
    void process(src, file?.bytes ? { file: { name: file.name, bytes: file.bytes } } : { text: b!.text });
    return json(view(src), 201);
  }

  if (route === "GET /ingestion/sources") {
    const list: IngestionSourceSummary[] = [...s.sources.values()]
      .filter((x) => x.user_id === ctx.userId)
      .sort((a, b) => b.started - a.started)
      .slice(0, 10)
      .map((x) => {
        const v = view(x);
        return { id: v.id, name: v.name, origin: v.origin, status: v.status, created_at: v.created_at, stats: v.stats };
      });
    return json(list);
  }

  const srcMatch = route.match(/^GET \/ingestion\/sources\/([^/]+)$/);
  if (srcMatch) {
    const src = s.sources.get(decodeURIComponent(srcMatch[1]));
    return src && src.user_id === ctx.userId ? json(view(src)) : fail(404, "not_found");
  }

  if (route === "POST /generation/variants") {
    const b = body as GenerateVariantsRequest | null;
    const src: MockSource | undefined = b ? [...s.sources.values()].find((x) => b.item_id.startsWith(`${x.id}_`)) : undefined;
    const item: PipelineItem | undefined = src?.items.find((i: PipelineItem) => i.id === b?.item_id);
    if (!b || !src || src.user_id !== ctx.userId || !item?._structure) return fail(404, "not_found");
    if (![3, 5, 10].includes(b.count) || !b.rules.length) return fail(422, "validation_error");
    const source = new Map(src.items.filter((i) => i._key).map((i) => [i._key!, `Câu ${i.index}`] as [string, string]));
    const generated = generateVariants(item._structure, { count: b.count, rules: b.rules, target: b.target, format: b.format }, { bank: bankIndex(), source });
    const meta = KIND_SKILL[item._structure.kind];
    const variants: Variant[] = generated.map((v) => ({
      id: newId("var"),
      item_id: item.id,
      statement: v.statement,
      format: v.format,
      choices: v.choices,
      answer_display: v.answer_display,
      answer_short: v.answer_short,
      answer_prefix: v.answer_prefix,
      solution: v.solution,
      rule: v.rule,
      transform: v.transform,
      grade: KIND_SKILL[v.structure.kind]?.grade ?? meta.grade,
      skill: SKILLS.find((sk) => sk.code === (KIND_SKILL[v.structure.kind]?.skill ?? meta.skill))!,
      difficulty: v.difficulty,
      checks: v.checks,
      accepted: v.accepted,
    }));
    for (const v of variants) s.variants.set(v.id, { variant: v, item });
    return json(variants);
  }

  if (route === "POST /generation/variants/submit") {
    const ids = (body as SubmitVariantsRequest | null)?.variant_ids ?? [];
    const chosen = ids.map((vid) => s.variants.get(vid)).filter((x): x is StoredVariant => !!x && x.variant.accepted);
    if (!chosen.length) return fail(422, "validation_error");
    ctx.pushReview(
      chosen.map(({ variant: v, item }) => ({
        id: `rv_${v.id}`,
        origin: "generated",
        statement: v.statement,
        answer_display: v.answer_display,
        solution: v.solution,
        grade: v.grade,
        skill: v.skill,
        difficulty: v.difficulty,
        classification_confidence: item.confidence,
        parent: { id: item.id, statement: item.statement },
        transform: `${v.rule.label}: ${v.transform}`,
        choices: v.choices.length ? v.choices : undefined,
        checks: v.checks,
      })),
    );
    for (const { variant } of chosen) s.variants.delete(variant.id);
    return json({ added: chosen.length });
  }

  return fail(404, "not_found");
}
