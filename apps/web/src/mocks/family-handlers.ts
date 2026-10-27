// Mock API cho tài khoản phụ huynh. Cùng hợp đồng với module family của FastAPI.
import type { ArenaBest, Assignment, ChildReport, ChildSummary, ExamSummary, LinkedParent, Progress } from "@/types/api";
import type { MockUser } from "./data";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 24 * 3600_000;
const REPORT_DAYS = 14;

interface Ctx {
  user: MockUser;
  users: MockUser[];
  progress: (userId: string) => Progress;
  exams: (userId: string) => ExamSummary[];
  assignments: (user: MockUser) => Assignment[];
  arena: (userId: string) => ArenaBest[];
  /** Mock chỉ giữ số bài hôm nay và độ dài chuỗi trước hôm nay. */
  daily: (userId: string) => { count: number; streakBefore: number };
  goal: number;
}

interface Store {
  /** parent_id → (student_id → linked_at) */
  links: Map<string, Map<string, string>>;
  codes: Map<string, { student_id: string; expires_at: string }>;
}

const g = globalThis as unknown as { __mathgenFamily?: Store };
function store(users: MockUser[]) {
  if (!g.__mathgenFamily) {
    const links = new Map<string, Map<string, string>>();
    for (const u of users) if (u.parent_of) links.set(u.id, new Map([[u.parent_of, new Date().toISOString()]]));
    g.__mathgenFamily = { links, codes: new Map() };
  }
  return g.__mathgenFamily;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (status: number, code: string) => json({ code }, status);
const noContent = () => new Response(null, { status: 204 });

/** Ngày YYYY-MM-DD theo giờ Việt Nam, lùi `back` ngày. */
function vnDay(back = 0) {
  return new Date(Date.now() + 7 * 3600_000 - back * 86_400_000).toISOString().slice(0, 10);
}

/** Mock không lưu lịch sử từng ngày: các ngày trong chuỗi coi như vừa đạt mục tiêu. */
function activity(ctx: Ctx, userId: string) {
  const d = ctx.daily(userId);
  return Array.from({ length: REPORT_DAYS }, (_, i) => {
    const back = REPORT_DAYS - 1 - i;
    return { day: vnDay(back), count: back === 0 ? d.count : back <= d.streakBefore ? ctx.goal : 0 };
  });
}

function summary(ctx: Ctx, child: MockUser, linkedAt: string): ChildSummary {
  const days = activity(ctx, child.id);
  const d = ctx.daily(child.id);
  const statuses = ctx.assignments(child).map((a) => a.status);
  const active = days.filter((x) => x.count > 0);
  return {
    id: child.id,
    full_name: child.full_name,
    grade: child.grade,
    linked_at: linkedAt,
    daily_goal: ctx.goal,
    today_problems: d.count,
    week_problems: days.slice(-7).reduce((t, x) => t + x.count, 0),
    streak_days: d.streakBefore + (d.count >= ctx.goal ? 1 : 0),
    pending_assignments: statuses.filter((s) => s === "todo" || s === "in_progress").length,
    missed_assignments: statuses.filter((s) => s === "missed").length,
    last_active: active.length ? active[active.length - 1].day : null,
  };
}

export function handleFamily(req: Request, path: string[], body: Record<string, unknown> | null, ctx: Ctx): Response | null {
  const { user, users } = ctx;
  const { links, codes } = store(users);
  const m = req.method;
  const [p0, p1, p2] = path.map(decodeURIComponent);

  // ---- Học sinh
  if (p0 === "me" && (p1 === "parent-code" || p1 === "parents")) {
    if (user.role !== "student") return fail(403, "forbidden");
    if (p1 === "parent-code" && m === "POST") {
      for (const [c, v] of codes) if (v.student_id === user.id) codes.delete(c);
      const code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
      const expires_at = new Date(Date.now() + CODE_TTL_MS).toISOString();
      codes.set(code, { student_id: user.id, expires_at });
      return json({ code, expires_at });
    }
    if (p1 === "parents" && !p2 && m === "GET") {
      const out: LinkedParent[] = [];
      for (const [parentId, kids] of links) {
        const p = users.find((u) => u.id === parentId);
        if (p && kids.has(user.id)) out.push({ id: p.id, full_name: p.full_name, email: p.email, linked_at: kids.get(user.id)! });
      }
      return json(out);
    }
    if (p1 === "parents" && p2 && m === "DELETE") {
      links.get(p2)?.delete(user.id);
      return noContent();
    }
  }

  // ---- Phụ huynh
  if (p0 !== "children") return null;
  if (user.role !== "parent") return fail(403, "forbidden");
  const mine = links.get(user.id) ?? new Map<string, string>();
  links.set(user.id, mine);

  if (p1 === "link" && m === "POST") {
    const code = String(body?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const entry = codes.get(code);
    if (!entry || new Date(entry.expires_at).getTime() <= Date.now()) return fail(404, "link_code_invalid");
    codes.delete(code);
    if (!mine.has(entry.student_id)) mine.set(entry.student_id, new Date().toISOString());
    const child = users.find((u) => u.id === entry.student_id)!;
    return json(summary(ctx, child, mine.get(child.id)!));
  }
  if (!p1 && m === "GET") {
    return json([...mine].flatMap(([id, at]) => {
      const child = users.find((u) => u.id === id);
      return child ? [summary(ctx, child, at)] : [];
    }));
  }
  const child = p1 && mine.has(p1) ? users.find((u) => u.id === p1) : undefined;
  if (!child) return fail(404, "not_found");
  if (m === "DELETE") {
    mine.delete(child.id);
    return noContent();
  }
  if (m === "GET") {
    const report: ChildReport = {
      child: summary(ctx, child, mine.get(child.id)!),
      progress: ctx.progress(child.id),
      activity: activity(ctx, child.id),
      exams: ctx.exams(child.id),
      assignments: ctx.assignments(child),
      arena: ctx.arena(child.id),
    };
    return json(report);
  }
  return fail(404, "not_found");
}
