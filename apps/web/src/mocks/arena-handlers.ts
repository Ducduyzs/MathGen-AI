// Mock API cho Đấu trường. Cùng hợp đồng (và cách tính điểm) với module arena của FastAPI.
import type { ArenaBest, ArenaBoardRow, ArenaItem, ArenaMe, ArenaPool, ArenaRun, ExamAnswer, ExamQuestion } from "@/types/api";
import type { MockUser } from "./data";
import type { ExamSource } from "./handlers";

const DURATIONS = [5, 15, 30];
const GRACE_MS = 5_000;
const BOARD_SIZE = 20;

type Current = ExamSource & { key: string };

interface MockRun {
  id: string;
  user_id: string;
  pool: ArenaPool;
  duration_minutes: ArenaRun["duration_minutes"];
  started_at: string;
  ends_at: string;
  finished_at: string | null;
  score: number;
  correct: number;
  answered: number;
  combo: number;
  best_combo: number;
  current: Current | null;
  history: (ArenaItem & { skill: string })[];
}

interface Ctx {
  user: MockUser;
  users: MockUser[];
  /** Dạng bài của kho (không có Đúng/Sai) kèm độ khó. */
  templates: (pool: ArenaPool) => { code: string; difficulty: number }[];
  generate: (codes: string[]) => ExamSource[] | null;
  grade: (q: ExamSource, a: ExamAnswer | undefined) => number;
  /** Ghi các câu đã làm hôm nay (chuỗi ngày học, XP, nhiệm vụ, bảng xếp hạng lớp). */
  addActivity: (userId: string, results: boolean[]) => void;
}

const g = globalThis as unknown as { __mathgenArena?: Map<string, MockRun> };
const runs = (): Map<string, MockRun> => (g.__mathgenArena ??= new Map());

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (status: number, code: string) => json({ code }, status);
const newId = () => `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const pointsFor = (difficulty: number, combo: number) => 10 + Math.round(10 * difficulty) + 2 * Math.min(combo, 5);

function nextQuestion(ctx: Ctx, pool: ArenaPool, answered: number, last: string | null): Current {
  const all = ctx.templates(pool);
  const ts = all.filter((t) => t.code !== last);
  const target = Math.min(0.2 + 0.03 * answered, 0.85);
  const near = [...(ts.length ? ts : all)].sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target)).slice(0, 4);
  const q = ctx.generate([near[Math.floor(Math.random() * near.length)].code])![0];
  return { ...q, key: Math.random().toString(16).slice(2, 10) };
}

/** 0 giờ thứ Hai tuần này, giờ Việt Nam (UTC+7). */
function weekStart() {
  const vn = new Date(Date.now() + 7 * 3600_000);
  const monday = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - ((vn.getUTCDay() + 6) % 7) * 86_400_000;
  return new Date(monday - 7 * 3600_000).toISOString();
}

function finalize(ctx: Ctx, r: MockRun) {
  if (r.finished_at) return;
  r.finished_at = new Date(Math.min(Date.now(), new Date(r.ends_at).getTime())).toISOString();
  r.current = null;
  ctx.addActivity(r.user_id, r.history.filter((h) => h.given).map((h) => h.is_correct));
}

function bestPerUser(pool: ArenaPool, duration: number, since: string | null) {
  const best = new Map<string, MockRun>();
  for (const r of runs().values()) {
    if (r.pool !== pool || r.duration_minutes !== duration || !r.finished_at || r.score <= 0) continue;
    if (since && r.finished_at < since) continue;
    const cur = best.get(r.user_id);
    if (!cur || r.score > cur.score) best.set(r.user_id, r);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.finished_at!.localeCompare(b.finished_at!));
}

const rankOf = (best: MockRun[], score: number) => 1 + best.filter((r) => r.score > score).length;

function out(r: MockRun): ArenaRun {
  const q = r.current;
  const run: ArenaRun = {
    id: r.id,
    pool: r.pool,
    duration_minutes: r.duration_minutes,
    started_at: r.started_at,
    ends_at: r.ends_at,
    finished: !!r.finished_at,
    score: r.score,
    correct: r.correct,
    answered: r.answered,
    combo: r.combo,
    best_combo: r.best_combo,
  };
  if (q) {
    const { key, answer: _a, answer_display: _d, solution: _s, tolerance: _t, ...pub } = q;
    run.question = { ...pub, id: key, index: r.answered + 1 } as ExamQuestion;
  }
  if (r.finished_at) {
    run.history = r.history.map(({ skill: _s, ...h }) => h);
    const since = weekStart();
    if (r.score > 0 && r.finished_at >= since) run.week_rank = rankOf(bestPerUser(r.pool, r.duration_minutes, since), r.score);
    const previous = Math.max(
      0,
      ...[...runs().values()]
        .filter((x) => x.id !== r.id && x.user_id === r.user_id && x.pool === r.pool && x.duration_minutes === r.duration_minutes && x.finished_at)
        .map((x) => x.score),
    );
    run.personal_best = r.score > previous;
  }
  return run;
}

export function handleArena(req: Request, path: string[], body: Record<string, unknown> | null, ctx: Ctx): Response | null {
  if (path[0] !== "arena") return null;
  const { user } = ctx;
  const m = req.method;
  const [, p1, p2, p3] = path.map(decodeURIComponent);
  const url = new URL(req.url);

  if (p1 === "me" && m === "GET") {
    const mine = [...runs().values()].filter((r) => r.user_id === user.id);
    const recent = mine
      .filter((r) => r.finished_at)
      .sort((a, b) => b.finished_at!.localeCompare(a.finished_at!))
      .slice(0, 8)
      .map((r) => ({ id: r.id, pool: r.pool, duration_minutes: r.duration_minutes, score: r.score, correct: r.correct, answered: r.answered, finished_at: r.finished_at! }));
    const active = mine.find((r) => !r.finished_at && new Date(r.ends_at).getTime() > Date.now());
    return json({ best: arenaBest(user.id), recent, active_run_id: active?.id ?? null } satisfies ArenaMe);
  }

  if (p1 === "leaderboard" && m === "GET") {
    const pool = (url.searchParams.get("pool") ?? "basic") as ArenaPool;
    const duration = Number(url.searchParams.get("duration") ?? 5);
    if (!DURATIONS.includes(duration) || !["basic", "thpt"].includes(pool)) return fail(422, "validation_error");
    const best = bestPerUser(pool, duration, url.searchParams.get("scope") === "all" ? null : weekStart());
    const row = (r: MockRun): ArenaBoardRow => {
      const u = ctx.users.find((x) => x.id === r.user_id);
      return {
        rank: rankOf(best, r.score),
        user_id: r.user_id,
        full_name: u?.full_name ?? "",
        grade: u?.grade ?? null,
        score: r.score,
        correct: r.correct,
        answered: r.answered,
        is_me: r.user_id === user.id,
      };
    };
    const rows = best.slice(0, BOARD_SIZE).map(row);
    const mine = best.find((r) => r.user_id === user.id);
    return json({ rows, me: mine && !rows.some((r) => r.is_me) ? row(mine) : null });
  }

  if (p1 === "runs" && !p2 && m === "POST") {
    const pool = (body?.pool ?? "basic") as ArenaPool;
    const duration = Number(body?.duration_minutes ?? 5) as ArenaRun["duration_minutes"];
    if (!DURATIONS.includes(duration) || !["basic", "thpt"].includes(pool)) return fail(422, "validation_error");
    for (const r of runs().values()) if (r.user_id === user.id && !r.finished_at) finalize(ctx, r);
    const now = Date.now();
    const r: MockRun = {
      id: newId(),
      user_id: user.id,
      pool,
      duration_minutes: duration,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + duration * 60_000).toISOString(),
      finished_at: null,
      score: 0,
      correct: 0,
      answered: 0,
      combo: 0,
      best_combo: 0,
      current: nextQuestion(ctx, pool, 0, null),
      history: [],
    };
    runs().set(r.id, r);
    return json(out(r), 201);
  }

  const r = p1 === "runs" && p2 ? runs().get(p2) : undefined;
  if (p1 === "runs" && (!r || r.user_id !== user.id)) return fail(404, "not_found");
  if (!r) return null;
  const expired = Date.now() > new Date(r.ends_at).getTime() + GRACE_MS;

  if (!p3 && m === "GET") {
    if (!r.finished_at && expired) finalize(ctx, r);
    return json(out(r));
  }
  if (p3 === "finish" && m === "POST") {
    finalize(ctx, r);
    return json(out(r));
  }
  if (p3 === "answer" && m === "POST") {
    if (r.finished_at || expired) {
      finalize(ctx, r);
      return fail(409, "run_over");
    }
    const q = r.current!;
    if (body?.key !== q.key) return fail(409, "stale_question");
    const given = (body?.answer ?? null) as ExamAnswer | null;
    const ok = !!given && ctx.grade(q, given) === 1;
    const points = ok ? pointsFor(q.difficulty, r.combo) : 0;
    r.history.push({
      statement: q.statement,
      template: q.template,
      skill: q.skill.code,
      ...(given ? { given } : {}),
      is_correct: ok,
      points,
      answer_display: q.answer_display,
    });
    r.answered += 1;
    r.correct += ok ? 1 : 0;
    r.score += points;
    r.combo = ok ? r.combo + 1 : 0;
    r.best_combo = Math.max(r.best_combo, r.combo);
    if (Date.now() >= new Date(r.ends_at).getTime()) finalize(ctx, r);
    else r.current = nextQuestion(ctx, r.pool, r.answered, q.template.code);
    return json({ is_correct: ok, points, correct_answer: q.answer, correct_answer_display: q.answer_display, run: out(r) });
  }
  return fail(404, "not_found");
}

/** Kỷ lục Đấu trường của một học sinh (trang phụ huynh). */
export function arenaBest(userId: string): ArenaBest[] {
  const best = new Map<string, ArenaBest>();
  for (const r of runs().values()) {
    if (r.user_id !== userId || !r.finished_at || r.score <= 0) continue;
    const k = `${r.pool}-${r.duration_minutes}`;
    if (!best.has(k) || best.get(k)!.score < r.score) best.set(k, { pool: r.pool, duration_minutes: r.duration_minutes, score: r.score });
  }
  return [...best.values()];
}
