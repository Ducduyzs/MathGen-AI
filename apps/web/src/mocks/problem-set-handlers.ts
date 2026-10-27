// Mock API cho Bộ đề của giáo viên. Cùng hợp đồng với module problem_sets của FastAPI.
import type { ExamMode, ExamQuestionType, ProblemSet, ProblemSetSummary, SetQuestion, Skill, TemplateCount, UpdateProblemSetRequest } from "@/types/api";
import type { MockUser } from "./data";
import type { ExamSource } from "./handlers";

const MAX_QUESTIONS = 100;

interface MockSet {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  questions: (ExamSource & { key: string })[];
  created_at: string;
  updated_at: string;
}

interface Ctx {
  user: MockUser;
  /** Sinh một câu cho mỗi mã dạng bài; null nếu có mã không tồn tại. */
  generate: (codes: string[]) => ExamSource[] | null;
}

const g = globalThis as unknown as { __mathgenSets?: Map<string, MockSet> };
const sets = (): Map<string, MockSet> => (g.__mathgenSets ??= new Map());

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (status: number, code: string) => json({ code }, status);
const newId = () => `set_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const newKey = () => Math.random().toString(16).slice(2, 10);

function summary(s: MockSet): ProblemSetSummary {
  const counts: Record<ExamQuestionType, number> = { choice: 0, true_false: 0, number: 0 };
  const skills = new Map<string, Skill>();
  for (const q of s.questions) {
    counts[q.type] += 1;
    if (!skills.has(q.skill.code)) skills.set(q.skill.code, q.skill);
  }
  const { questions: _q, teacher_id: _t, ...base } = s;
  return { ...base, size: s.questions.length, counts, skills: [...skills.values()] };
}

const detail = (s: MockSet): ProblemSet => ({
  ...summary(s),
  questions: s.questions.map(({ tolerance: _t, ...q }) => q as SetQuestion),
});

function generate(ctx: Ctx, items: TemplateCount[] | undefined, have: number): MockSet["questions"] | Response {
  const codes = (items ?? []).flatMap((i) => Array.from({ length: Math.max(1, Math.min(20, i.count ?? 1)) }, () => i.template));
  if (have + codes.length > MAX_QUESTIONS) return fail(422, "set_too_large");
  const built = ctx.generate(codes);
  if (!built) return fail(422, "no_template");
  return built.map((q) => ({ ...q, key: newKey() }));
}

/** Bộ đề → câu hỏi để giao cho lớp (bài giao là bản chụp, không có `key`). */
export function setSource(userId: string, setId: string): { title: string; mode: ExamMode; source: ExamSource[] } | Response {
  const s = sets().get(setId);
  if (!s || s.teacher_id !== userId) return fail(404, "not_found");
  if (!s.questions.length) return fail(422, "set_empty");
  return {
    title: s.title,
    mode: s.questions.every((q) => q.type === "number") ? "written" : "choice",
    source: s.questions.map(({ key: _k, ...q }) => q),
  };
}

export function handleProblemSets(req: Request, path: string[], body: Record<string, unknown> | null, ctx: Ctx): Response | null {
  if (path[0] !== "problem-sets") return null;
  const { user } = ctx;
  if (user.role !== "teacher" && user.role !== "admin") return fail(403, "forbidden");
  const m = req.method;
  const [, p1, p2, p3, p4] = path.map(decodeURIComponent);
  const now = new Date().toISOString();

  if (!p1) {
    if (m === "GET") {
      const mine = [...sets().values()].filter((s) => s.teacher_id === user.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return json(mine.map(summary));
    }
    if (m === "POST") {
      const title = String(body?.title ?? "").trim();
      if (title.length < 2) return fail(422, "validation_error");
      const questions = generate(ctx, body?.items as TemplateCount[] | undefined, 0);
      if (questions instanceof Response) return questions;
      const s: MockSet = { id: newId(), teacher_id: user.id, title, description: String(body?.description ?? "").trim() || null, questions, created_at: now, updated_at: now };
      sets().set(s.id, s);
      return json(detail(s), 201);
    }
  }

  const s = p1 ? sets().get(p1) : undefined;
  if (!s || (s.teacher_id !== user.id && user.role !== "admin")) return fail(404, "not_found");
  const save = () => {
    s.updated_at = new Date().toISOString();
    return json(detail(s));
  };

  if (!p2) {
    if (m === "GET") return json(detail(s));
    if (m === "DELETE") {
      sets().delete(s.id);
      return new Response(null, { status: 204 });
    }
    if (m === "PATCH") {
      const b = (body ?? {}) as UpdateProblemSetRequest;
      if (b.title !== undefined) {
        if (b.title.trim().length < 2) return fail(422, "validation_error");
        s.title = b.title.trim();
      }
      if ("description" in b) s.description = b.description?.trim() || null;
      if (b.order) {
        const byKey = new Map(s.questions.map((q) => [q.key, q]));
        if (new Set(b.order).size !== b.order.length || b.order.some((k) => !byKey.has(k))) return fail(422, "validation_error");
        s.questions = b.order.map((k) => byKey.get(k)!);
      }
      return save();
    }
  }
  if (p2 === "questions" && !p3 && m === "POST") {
    const added = generate(ctx, body?.items as TemplateCount[] | undefined, s.questions.length);
    if (added instanceof Response) return added;
    s.questions = [...s.questions, ...added];
    return save();
  }
  if (p2 === "questions" && p3 && p4 === "regenerate" && m === "POST") {
    const i = s.questions.findIndex((q) => q.key === p3);
    if (i < 0) return fail(404, "not_found");
    const fresh = generate(ctx, [{ template: s.questions[i].template.code, count: 1 }], 0);
    if (fresh instanceof Response) return fresh;
    s.questions = s.questions.map((q, j) => (j === i ? fresh[0] : q));
    return save();
  }
  if (p2 === "duplicate" && m === "POST") {
    const copy: MockSet = {
      ...s,
      id: newId(),
      teacher_id: user.id,
      title: `${s.title} (bản sao)`.slice(0, 200),
      questions: s.questions.map((q) => ({ ...q, key: newKey() })),
      created_at: now,
      updated_at: now,
    };
    sets().set(copy.id, copy);
    return json(summary(copy), 201);
  }
  return fail(404, "not_found");
}
