// Mock backend chạy trong Next.js khi MOCK_API=1. Mô phỏng hợp đồng API của FastAPI
// để frontend phát triển trước. Trạng thái nằm trong bộ nhớ, mất khi khởi động lại server.
import { parseNumber, sameNumber } from "@/lib/math-input";
import { difficultyLevel } from "@/lib/utils";
import type {
  AnswerValue,
  AttemptRequest,
  AttemptResult,
  AttemptSummary,
  CreateExamRequest,
  Exam,
  ExamAnswer,
  ExamMode,
  ExamQuestion,
  ExamResult,
  ExamSummary,
  LoginResponse,
  Paginated,
  Progress,
  PublicProblem,
  RegisterRequest,
  ReviewItem,
  User,
} from "@/types/api";
import {
  DAILY_GOAL,
  PROBLEMS,
  REVIEW_QUEUE,
  SEED_ATTEMPTS,
  SEED_DAILY,
  SEED_SCORES,
  SEED_TOTALS,
  SKILLS,
  USERS,
  type MockProblem,
  type MockUser,
} from "./data";
import { buildQuestions, buildThptQuestions, TEMPLATES } from "./exam-generator";
import type { Generated } from "./gen-utils";
import { arenaBest, handleArena } from "./arena-handlers";
import { handleClassroom, myAssignments } from "./classroom-handlers";
import { handleFamily } from "./family-handlers";
import { handleIngestion, handleStorageUpload } from "./ingestion-handlers";
import { handleProblemSets, setSource } from "./problem-set-handlers";
import { THPT_BLUEPRINT } from "./thpt-templates";

export const EXAM_SIZES: Record<ExamMode, number[]> = { choice: [10, 20, 40, 100], written: [5, 10, 20, 40] };
export const OFFICIAL_TITLE = "Đề thi tốt nghiệp THPT · Môn Toán";

type MockExamQuestion = ExamQuestion & { answer: ExamAnswer; answer_display: string; solution: string[]; tolerance?: number };

export interface MockExam extends Omit<Exam, "questions"> {
  user_id: string;
  questions: (MockExamQuestion & { source_index?: number })[];
}

export type ExamSource = Omit<MockExamQuestion, "id" | "index">;

interface AttemptRecord {
  id: string;
  user_id: string;
  problem_id: string;
  is_correct: boolean;
  created_at: string;
}

interface State {
  users: MockUser[];
  scores: Map<string, Map<string, { score: number; n: number }>>;
  totals: Map<string, { total: number; correct: number }>;
  daily: Map<string, { date: string; count: number; streakBefore: number }>;
  attempts: AttemptRecord[];
  recent: Map<string, string[]>;
  idempotency: Map<string, AttemptResult>;
  review: ReviewItem[];
  exams: Map<string, MockExam>;
  /** Bài luyện tập sinh từ dạng bài cho các kỹ năng chưa có trong ngân hàng mẫu. */
  generated: Map<string, MockProblem>;
}

function seed(): State {
  const studentId = "u_student";
  return {
    users: [...USERS],
    scores: new Map([[studentId, new Map(Object.entries(SEED_SCORES).map(([k, v]) => [k, { ...v }]))]]),
    totals: new Map([[studentId, { ...SEED_TOTALS }]]),
    daily: new Map([[studentId, { date: today(), ...SEED_DAILY }]]),
    attempts: SEED_ATTEMPTS.map((a, i) => ({
      id: `seed${i}`,
      user_id: studentId,
      problem_id: a.problem_id,
      is_correct: a.is_correct,
      created_at: new Date(Date.now() - a.minutesAgo * 60_000).toISOString(),
    })),
    recent: new Map(),
    idempotency: new Map(),
    review: [...REVIEW_QUEUE],
    exams: new Map(),
    generated: new Map(),
  };
}

function today() {
  return new Date().toDateString();
}

/** Lấy bộ đếm ngày; sang ngày mới thì chốt chuỗi của ngày trước (mock: coi như hôm qua). */
function dailyOf(userId: string) {
  const s = state();
  const d = s.daily.get(userId) ?? { date: today(), count: 0, streakBefore: 0 };
  if (d.date !== today()) {
    d.streakBefore = d.count >= DAILY_GOAL ? d.streakBefore + 1 : 0;
    d.date = today();
    d.count = 0;
  }
  s.daily.set(userId, d);
  return d;
}

// Giữ trạng thái qua hot reload khi dev.
const g = globalThis as unknown as { __mathgenMock?: State };
function state() {
  const s = (g.__mathgenMock ??= seed());
  s.exams ??= new Map(); // trạng thái tạo từ phiên bản mock cũ (hot reload)
  s.daily ??= new Map();
  s.generated ??= new Map();
  return s;
}

const findProblem = (problemId: string | null | undefined) =>
  problemId ? (PROBLEMS.find((p) => p.id === problemId) ?? state().generated.get(problemId)) : undefined;

/** Sinh một bài luyện tập từ dạng bài (chỉ dạng A/B/C/D hoặc điền số). */
function generateProblem(skillCode: string): MockProblem | null {
  const templates = TEMPLATES.filter((t) => t.skill === skillCode && t.type !== "true_false");
  if (!templates.length) return null;
  const t = templates[Math.floor(Math.random() * templates.length)];
  const g: Generated = t.make();
  if (g.answer.type === "true_false") return null;
  const p: MockProblem = {
    id: id("gp"),
    grade: t.grade,
    skill: SKILLS.find((sk) => sk.code === skillCode)!,
    difficulty: t.difficulty,
    statement: g.statement,
    answer_type: g.answer.type,
    answer_prefix: g.answer_prefix,
    choices: g.choices,
    answer: g.answer,
    answer_display: g.answer_display,
    solution: g.solution,
  };
  state().generated.set(p.id, p);
  return p;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });
const fail = (status: number, code: string) => json({ code }, status);
const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const toUser = ({ password: _password, parent_of: _parentOf, ...u }: MockUser): User => u;
const toPublic = ({ answer: _a, answer_display: _d, solution: _s, ...p }: MockProblem): PublicProblem => p;

function session(u: MockUser) {
  const body: LoginResponse = { access_token: `mock.${u.id}`, user: toUser(u) };
  return json(body, 200, { "Set-Cookie": `refresh_token=${u.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` });
}

function authUser(req: Request) {
  const m = req.headers.get("authorization")?.match(/^Bearer mock\.(.+)$/);
  return m ? (state().users.find((u) => u.id === m[1]) ?? null) : null;
}

function cookieUser(req: Request) {
  const m = req.headers.get("cookie")?.match(/(?:^|;\s*)refresh_token=([^;]+)/);
  return m ? (state().users.find((u) => u.id === decodeURIComponent(m[1])) ?? null) : null;
}

function scoresOf(userId: string) {
  const s = state();
  let map = s.scores.get(userId);
  if (!map) {
    map = new Map(SKILLS.map((sk) => [sk.code, { score: 0.5, n: 0 }]));
    s.scores.set(userId, map);
  }
  return map;
}

function grade(p: MockProblem, a: AnswerValue) {
  const expected = p.answer;
  if (a.type === "choice" && expected.type === "choice") return a.value === expected.value;
  if (a.type === "number" && expected.type === "number") return sameNumber(a.value, expected.value);
  if (a.type === "set" && expected.type === "set") {
    const norm = (xs: string[]) => xs.map(parseNumber).filter((x): x is number => x !== null).sort((x, y) => x - y);
    const got = norm(a.value);
    const want = norm(expected.value);
    return got.length === a.value.length && got.length === want.length && got.every((x, i) => Math.abs(x - want[i]) < 1e-9);
  }
  return false;
}

/** Chọn kỹ năng yếu với xác suất cao hơn, rồi chọn bài có độ khó gần năng lực. */
function pickNext(userId: string, skillCode: string | null) {
  const scores = scoresOf(userId);
  const recent = state().recent.get(userId) ?? [];
  let code = skillCode;
  if (!code) {
    // Tự chọn chỉ trong các kỹ năng có bài ở ngân hàng mẫu (Đại số lớp 6–10).
    const weights = SKILLS.filter((sk) => PROBLEMS.some((p) => p.skill.code === sk.code)).map((sk) => ({
      code: sk.code,
      w: 1.05 - (scores.get(sk.code)?.score ?? 0.5),
    }));
    let roll = Math.random() * weights.reduce((t, x) => t + x.w, 0);
    code = weights.find((x) => (roll -= x.w) <= 0)?.code ?? weights[0].code;
  }
  const pool = PROBLEMS.filter((p) => p.skill.code === code);
  if (!pool.length) return generateProblem(code);
  const fresh = pool.filter((p) => !recent.includes(p.id));
  const candidates = fresh.length ? fresh : pool.filter((p) => p.id !== recent[0]);
  const ability = scores.get(code)?.score ?? 0.5;
  const ranked = (candidates.length ? candidates : pool).sort(
    (a, b) => Math.abs(a.difficulty - ability) - Math.abs(b.difficulty - ability),
  );
  const top = ranked.slice(0, 3);
  return top[Math.floor(Math.random() * top.length)];
}

// ---------------- Làm đề

const toPublicExam = (e: MockExam): Exam => ({
  id: e.id,
  title: e.title,
  kind: e.kind,
  mode: e.mode,
  size: e.size,
  created_at: e.created_at,
  duration_minutes: e.duration_minutes,
  ends_at: e.ends_at,
  result: e.result,
  assignment_id: e.assignment_id ?? null,
  answers: e.result ? (e.answers ?? null) : null,
  questions: e.questions.map(({ answer: _a, answer_display: _d, solution: _s, tolerance: _t, source_index: _i, ...q }) => q),
});

type BuiltQuestion = { template: (typeof TEMPLATES)[number] } & Generated;

const toExamQuestion = ({ template, ...g }: BuiltQuestion): Omit<MockExamQuestion, "id" | "index"> => ({
  type: template.type,
  template: { code: template.code, name: template.name },
  skill: SKILLS.find((sk) => sk.code === template.skill)!,
  grade: template.grade,
  difficulty: template.difficulty,
  ...g,
});

const BY_CODE = new Map(TEMPLATES.map((t) => [t.code, t]));

/** Một câu cho mỗi mã dạng bài, theo đúng thứ tự (bộ đề, Đấu trường). null nếu có mã không tồn tại. */
function generateFrom(codes: string[]): ExamSource[] | null {
  if (codes.some((c) => !BY_CODE.has(c))) return null;
  return codes.map((c) => {
    const t = BY_CODE.get(c)!;
    return toExamQuestion({ template: t, ...t.make() });
  });
}

/** Sinh câu hỏi cho đề ôn tập / đề thi THPT (dùng chung cho bài giao của lớp). */
function buildSource(b: CreateExamRequest): { mode: ExamMode; source: ExamSource[] } | Response {
  if (b.kind === "official") return { mode: "choice", source: buildThptQuestions().map(toExamQuestion) };
  if (b.mode !== "choice" && b.mode !== "written") return fail(422, "validation_error");
  if (!b.size || !EXAM_SIZES[b.mode].includes(b.size)) return fail(422, "validation_error");
  const built = buildQuestions(b.mode, b.size, { skills: b.skills, templates: b.templates });
  if (!built) return fail(422, "no_template");
  return { mode: b.mode, source: built.map(toExamQuestion) };
}

function addExam(
  userId: string,
  e: Pick<MockExam, "title" | "kind" | "mode" | "duration_minutes" | "ends_at"> & { assignment_id?: string },
  source: (ExamSource & { source_index?: number })[],
): MockExam {
  const examId = id("ex");
  const exam: MockExam = {
    ...e,
    id: examId,
    user_id: userId,
    size: source.length,
    created_at: new Date().toISOString(),
    result: null,
    questions: source.map((q, i) => ({ ...q, id: `${examId}_q${i + 1}`, index: i + 1 })),
  };
  state().exams.set(examId, exam);
  return exam;
}

function createExam(userId: string, b: CreateExamRequest): MockExam | Response {
  if (b.kind === "official" && b.blueprint !== "thpt") return fail(422, "validation_error");
  if (b.kind !== "official" && b.retry_of) {
    const orig = state().exams.get(b.retry_of);
    if (!orig || orig.user_id !== userId || !orig.result) return fail(404, "not_found");
    const wrong = new Set(orig.result.items.filter((i) => !i.is_correct).map((i) => i.question_id));
    const source = orig.questions.filter((q) => wrong.has(q.id)).map(({ id: _id, index: _ix, source_index: _si, ...q }) => q);
    if (!source.length) return fail(422, "validation_error");
    return addExam(userId, { title: `Làm lại ${source.length} câu sai`, kind: "practice", mode: orig.mode, duration_minutes: null, ends_at: null }, source);
  }
  const built = buildSource(b);
  if (built instanceof Response) return built;
  if (b.kind === "official") {
    const duration = THPT_BLUEPRINT.duration_minutes;
    return addExam(
      userId,
      { title: OFFICIAL_TITLE, kind: "official", mode: "choice", duration_minutes: duration, ends_at: new Date(Date.now() + duration * 60_000).toISOString() },
      built.source,
    );
  }
  const label = b.templates?.length ? "Ôn dạng đã sai" : built.mode === "choice" ? "Đề ôn tập trắc nghiệm" : "Đề ôn tập tự luận";
  return addExam(userId, { title: `${label} · ${b.size} câu`, kind: "practice", mode: built.mode, duration_minutes: null, ends_at: null }, built.source);
}

const TF_POINTS = [0, 0.1, 0.25, 0.5, 1];

function gradeExamAnswer(q: MockExamQuestion, a: ExamAnswer | undefined) {
  const exp = q.answer;
  if (exp.type === "choice" && a?.type === "choice") return exp.value === a.value ? 1 : 0;
  if (exp.type === "number" && a?.type === "number") {
    if (!q.tolerance) return sameNumber(a.value, exp.value) ? 1 : 0;
    const got = parseNumber(a.value);
    const want = parseNumber(exp.value);
    return got !== null && want !== null && Math.abs(got - want) <= q.tolerance ? 1 : 0;
  }
  if (exp.type === "true_false" && a?.type === "true_false") {
    const matches = Object.keys(exp.value).filter((k) => a.value[k] === exp.value[k]).length;
    return TF_POINTS[matches];
  }
  return 0;
}

function submitExam(e: MockExam, answers: Record<string, ExamAnswer>): ExamResult {
  const items = e.questions.map((q) => {
    const points = gradeExamAnswer(q, answers[q.id]);
    return {
      question_id: q.id,
      is_correct: points === 1,
      points,
      correct_answer: q.answer,
      correct_answer_display: q.answer_display,
      solution: q.solution,
    };
  });
  const correct = items.filter((i) => i.is_correct).length;

  // Đề thi: mỗi loại câu có trọng số riêng (Phần I 0,25 · Phần II tối đa 1 · Phần III 0,5) → tổng 10.
  // Đề ôn tập: các câu bằng điểm nhau, quy về thang 10.
  let score: number;
  let parts: ExamResult["parts"] = [];
  if (e.kind === "official") {
    parts = THPT_BLUEPRINT.parts.map((p) => {
      const idx = e.questions.flatMap((q, i) => (q.type === p.type ? [i] : []));
      return {
        label: `Phần ${p.part}`,
        earned: Math.round(idx.reduce((t, i) => t + items[i].points * p.points, 0) * 100) / 100,
        max: p.count * p.points,
      };
    });
    score = Math.round(parts.reduce((t, p) => t + p.earned, 0) * 100) / 100;
  } else {
    score = Math.round((items.reduce((t, i) => t + i.points, 0) / e.questions.length) * 1000) / 100;
  }
  const wrongTemplates = new Map(e.questions.filter((q, i) => !items[i].is_correct).map((q) => [q.template.code, q.template]));

  // Ở backend thật: worker cập nhật hồ sơ năng lực bất đồng bộ (trọng số nhỏ hơn luyện tập).
  const scores = scoresOf(e.user_id);
  e.questions.forEach((q, i) => {
    const sc = scores.get(q.skill.code);
    if (!sc) return;
    sc.score = Math.min(1, Math.max(0, sc.score + 0.05 * ((items[i].is_correct ? 1 : 0) - sc.score)));
    sc.n += 1;
  });
  const answered = e.questions.filter((q) => answers[q.id]).length;
  dailyOf(e.user_id).count += answered;
  const totals = state().totals.get(e.user_id) ?? { total: 0, correct: 0 };
  state().totals.set(e.user_id, { total: totals.total + e.questions.length, correct: totals.correct + correct });

  return {
    correct,
    total: e.questions.length,
    score,
    parts,
    items,
    wrong_templates: [...wrongTemplates.values()],
    submitted_at: new Date().toISOString(),
  };
}

function progressOf(userId: string): Progress {
  const scores = scoresOf(userId);
  const totals = state().totals.get(userId) ?? { total: 0, correct: 0 };
  const daily = dailyOf(userId);
  return {
    // Học sinh mẫu chỉ có điểm ban đầu cho vài kỹ năng: kỹ năng còn lại coi như chưa luyện
    skills: SKILLS.map((sk) => {
      const sc = scores.get(sk.code) ?? { score: 0.5, n: 0 };
      return { ...sk, score: sc.score, n_attempts: sc.n };
    }),
    total_attempts: totals.total,
    correct_attempts: totals.correct,
    daily_goal: DAILY_GOAL,
    today_attempts: daily.count,
    streak_days: daily.streakBefore + (daily.count >= DAILY_GOAL ? 1 : 0),
  };
}

function recentExams(userId: string): ExamSummary[] {
  return [...state().exams.values()]
    .filter((e) => e.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      title: e.title,
      kind: e.kind,
      mode: e.mode,
      size: e.size,
      created_at: e.created_at,
      score: e.result?.score ?? null,
      correct: e.result?.correct ?? null,
    }));
}

export async function handleMock(req: Request, path: string[]): Promise<Response> {
  await sleep(150 + Math.random() * 250);
  const s = state();
  const url = new URL(req.url);
  const route = `${req.method} /${path.join("/")}`;
  // Link tải lên ký sẵn (giả lập R2): nhận file nhị phân, không cần đăng nhập.
  if (req.method === "PUT" && path[0] === "storage" && path[1]) return handleStorageUpload(req, decodeURIComponent(path[1]));
  const body = req.method === "POST" || req.method === "PATCH" ? await req.json().catch(() => null) : null;

  // ---- Xác thực
  if (route === "POST /auth/login") {
    const email = String(body?.email ?? "").toLowerCase();
    const u = s.users.find((x) => x.email === email && x.password === body?.password);
    return u ? session(u) : fail(401, "invalid_credentials");
  }
  if (route === "POST /auth/register") {
    const b = body as RegisterRequest | null;
    const role = b?.role ?? "student";
    if (!b?.email || !b.password || !b.full_name || !["student", "parent"].includes(role) || (role === "student" && !b.grade)) {
      return fail(422, "validation_error");
    }
    if (s.users.some((x) => x.email === b.email.toLowerCase())) return fail(409, "email_taken");
    const u: MockUser = {
      id: id("u"),
      email: b.email.toLowerCase(),
      password: b.password,
      full_name: b.full_name,
      role,
      grade: role === "student" ? (b.grade ?? null) : null,
    };
    s.users.push(u);
    return session(u);
  }
  if (route === "POST /auth/refresh") {
    const u = cookieUser(req);
    return u ? json({ access_token: `mock.${u.id}` }) : fail(401, "unauthorized");
  }
  if (route === "POST /auth/logout") {
    return new Response(null, { status: 204, headers: { "Set-Cookie": "refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" } });
  }

  // ---- Công khai
  if (route === "GET /skills") return json(SKILLS);
  if (route === "GET /problems") {
    const gradeQ = url.searchParams.get("grade");
    const skillQ = url.searchParams.get("skill");
    const levelQ = url.searchParams.get("level");
    const q = url.searchParams.get("q")?.toLowerCase();
    const items = PROBLEMS.filter(
      (p) =>
        (!gradeQ || p.grade === Number(gradeQ)) &&
        (!skillQ || p.skill.code === skillQ) &&
        (!levelQ || difficultyLevel(p.difficulty).level === Number(levelQ)) &&
        (!q || p.statement.toLowerCase().includes(q)),
    )
      .sort((a, b) => a.grade - b.grade || a.difficulty - b.difficulty)
      .map(toPublic);
    return json({ items, total: items.length } satisfies Paginated<PublicProblem>);
  }
  const problemMatch = route.match(/^GET \/problems\/([^/]+)$/);
  if (problemMatch) {
    const p = PROBLEMS.find((x) => x.id === problemMatch[1]);
    return p ? json(toPublic(p)) : fail(404, "not_found");
  }

  // ---- Cần đăng nhập
  const user = authUser(req);
  if (!user) return fail(401, "unauthorized");

  if (route === "GET /me") return json(toUser(user));

  if (route === "GET /me/progress") return json(progressOf(user.id));

  if (route === "GET /me/attempts") {
    const limit = Number(url.searchParams.get("limit") ?? 10);
    const items: AttemptSummary[] = s.attempts
      .filter((a) => a.user_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((a) => {
        const p = findProblem(a.problem_id)!;
        return { id: a.id, problem_id: p.id, statement: p.statement, skill: p.skill, is_correct: a.is_correct, created_at: a.created_at };
      });
    return json(items);
  }

  if (route === "GET /practice/next") {
    // similar_to: bài cùng kỹ năng, độ khó gần bài vừa làm (backend thật có thể sinh biến thể mới).
    const similar = findProblem(url.searchParams.get("similar_to"));
    const p = pickNext(user.id, similar?.skill.code ?? url.searchParams.get("skill"));
    if (!p) return fail(404, "no_problem");
    const recent = s.recent.get(user.id) ?? [];
    s.recent.set(user.id, [p.id, ...recent.filter((x) => x !== p.id)].slice(0, 6));
    return json(toPublic(p));
  }

  if (route === "POST /attempts") {
    const key = req.headers.get("idempotency-key");
    if (key && s.idempotency.has(key)) return json(s.idempotency.get(key));
    const b = body as AttemptRequest | null;
    const p = findProblem(b?.problem_id);
    if (!b || !p) return fail(422, "validation_error");

    const ok = grade(p, b.answer);
    const attemptId = id("att");
    s.attempts.push({ id: attemptId, user_id: user.id, problem_id: p.id, is_correct: ok, created_at: new Date().toISOString() });

    // Ở backend thật, phần này do worker hàng đợi `learning` làm bất đồng bộ.
    // Đúng nhờ gợi ý chỉ được cộng nửa mức.
    const scores = scoresOf(user.id);
    const sc = scores.get(p.skill.code) ?? { score: 0.5, n: 0 };
    scores.set(p.skill.code, sc);
    const delta = 0.12 * ((ok ? 1 : 0) - sc.score) * (ok && b.hints_used > 0 ? 0.5 : 1);
    sc.score = Math.min(1, Math.max(0, sc.score + delta));
    sc.n += 1;
    dailyOf(user.id).count += 1;
    const totals = s.totals.get(user.id) ?? { total: 0, correct: 0 };
    s.totals.set(user.id, { total: totals.total + 1, correct: totals.correct + (ok ? 1 : 0) });

    const result: AttemptResult = {
      attempt_id: attemptId,
      is_correct: ok,
      correct_answer: p.answer,
      correct_answer_display: p.answer_display,
      solution: p.solution,
    };
    if (key) s.idempotency.set(key, result);
    return json(result);
  }

  // ---- Làm đề
  if (route === "GET /exams/templates") return json(TEMPLATES.map(({ make: _m, ...t }) => t));
  if (route === "GET /exams") return json(recentExams(user.id));
  if (route === "POST /exams") {
    const created = createExam(user.id, (body ?? {}) as CreateExamRequest);
    return created instanceof Response ? created : json(toPublicExam(created), 201);
  }
  if (path[0] === "exams" && path[1]) {
    const exam = s.exams.get(decodeURIComponent(path[1]));
    if (!exam || exam.user_id !== user.id) return fail(404, "not_found");
    if (req.method === "GET" && path.length === 2) return json(toPublicExam(exam));
    if (req.method === "POST" && path[2] === "submit") {
      // Nộp lại đề đã chấm: trả kết quả cũ (an toàn khi mạng lỗi và client gửi lại).
      if (!exam.result) {
        exam.answers = (body?.answers ?? {}) as Record<string, ExamAnswer>;
        exam.result = submitExam(exam, exam.answers);
      }
      return json(toPublicExam(exam));
    }
  }

  // ---- Lớp học & bài giao
  const classCtx = (u: MockUser) => ({
    user: u,
    users: s.users,
    exams: s.exams,
    buildSource,
    setSource: (setId: string) => setSource(u.id, setId),
    addExam,
    activity: (userId: string) => {
      const d = dailyOf(userId);
      return { week: d.count, streak: d.streakBefore + (d.count >= DAILY_GOAL ? 1 : 0) };
    },
    publicExam: toPublicExam,
  });
  const classroom = handleClassroom(req, path, body, classCtx(user));
  if (classroom) return classroom;

  // ---- Bộ đề, Đấu trường, phụ huynh
  const problemSets = handleProblemSets(req, path, body, { user, generate: generateFrom });
  if (problemSets) return problemSets;
  const arena = handleArena(req, path, body, {
    user,
    users: s.users,
    templates: (pool) => TEMPLATES.filter((t) => t.type !== "true_false" && (pool === "thpt") === !!t.part),
    generate: generateFrom,
    grade: (q, a) => gradeExamAnswer(q as MockExamQuestion, a),
    addActivity: (userId, n) => {
      dailyOf(userId).count += n;
    },
  });
  if (arena) return arena;
  const family = handleFamily(req, path, body, {
    user,
    users: s.users,
    progress: progressOf,
    exams: recentExams,
    assignments: (u) => myAssignments(classCtx(u)),
    arena: arenaBest,
    daily: dailyOf,
    goal: DAILY_GOAL,
  });
  if (family) return family;

  // ---- Tải đề & sinh câu hỏi (giáo viên / quản trị)
  const ingestion = await handleIngestion(req, path, body, {
    userId: user.id,
    role: user.role,
    pushReview: (items) => {
      s.review = [...items, ...s.review];
    },
  });
  if (ingestion) return ingestion;

  // ---- Giáo viên / quản trị
  if (route === "GET /review/queue" || route.startsWith("POST /review/")) {
    if (user.role === "student") return fail(403, "forbidden");
    if (route === "GET /review/queue") return json(s.review);
    const reviewId = decodeURIComponent(path[1] ?? "");
    if (!s.review.some((x) => x.id === reviewId)) return fail(404, "not_found");
    if (body?.decision !== "approve" && body?.decision !== "reject") return fail(422, "validation_error");
    s.review = s.review.filter((x) => x.id !== reviewId);
    return new Response(null, { status: 204 });
  }

  return fail(404, "not_found");
}
