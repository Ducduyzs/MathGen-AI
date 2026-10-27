// Mock API cho lớp học & bài giao. Cùng hợp đồng với module classroom của FastAPI;
// trạng thái nằm trong bộ nhớ như phần còn lại của mock.
import type {
  Assignment,
  AssignmentReport,
  AssignmentStatus,
  ClassDetail,
  ClassRoom,
  CreateAssignmentRequest,
  CreateExamRequest,
  Exam,
  ExamMode,
  LeaderboardRow,
  QuestionStat,
} from "@/types/api";
import type { MockUser } from "./data";
import type { ExamSource, MockExam } from "./handlers";
import { THPT_BLUEPRINT } from "./thpt-templates";

interface MockClass {
  id: string;
  teacher_id: string;
  name: string;
  grade: number | null;
  join_code: string;
  created_at: string;
  members: Map<string, string>; // user_id → joined_at
}

interface MockAssignment extends Omit<Assignment, "class_name" | "member_count" | "submitted_count" | "average_score" | "status" | "exam_id" | "score"> {
  questions: ExamSource[];
}

interface Ctx {
  user: MockUser;
  users: MockUser[];
  exams: Map<string, MockExam>;
  buildSource: (b: CreateExamRequest) => { mode: ExamMode; source: ExamSource[] } | Response;
  /** Bộ đề của giáo viên → câu hỏi để giao. */
  setSource: (setId: string) => { title: string; mode: ExamMode; source: ExamSource[] } | Response;
  addExam: (
    userId: string,
    e: Pick<MockExam, "title" | "kind" | "mode" | "duration_minutes" | "ends_at"> & { assignment_id?: string },
    source: (ExamSource & { source_index?: number })[],
  ) => MockExam;
  activity: (userId: string) => { week: number; streak: number };
  publicExam: (e: MockExam) => Exam;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GRACE_MS = 2 * 60_000;

const g = globalThis as unknown as { __mathgenClasses?: { classes: Map<string, MockClass>; assignments: Map<string, MockAssignment> } };
const store = () => (g.__mathgenClasses ??= { classes: new Map(), assignments: new Map() });

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (status: number, code: string) => json({ code }, status);
const noContent = () => new Response(null, { status: 204 });
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
const round2 = (x: number) => Math.round(x * 100) / 100;
const mean = (xs: number[]) => (xs.length ? round2(xs.reduce((t, x) => t + x, 0) / xs.length) : null);

const isTeacher = (u: MockUser) => u.role === "teacher" || u.role === "admin";
const owns = (u: MockUser, c: MockClass) => c.teacher_id === u.id || u.role === "admin";

function examOf(ctx: Ctx, assignmentId: string, userId: string) {
  return [...ctx.exams.values()].find((e) => e.assignment_id === assignmentId && e.user_id === userId);
}

function statusOf(a: MockAssignment, exam: MockExam | undefined): AssignmentStatus {
  const due = a.due_at ? new Date(a.due_at).getTime() : null;
  if (exam?.result) return due && new Date(exam.result.submitted_at).getTime() > due + GRACE_MS ? "late" : "submitted";
  if (due && Date.now() > due + GRACE_MS) return "missed";
  return exam ? "in_progress" : "todo";
}

function classOut(ctx: Ctx, c: MockClass): ClassRoom {
  const { assignments } = store();
  const mine = [...assignments.values()].filter((a) => a.class_id === c.id);
  const owner = owns(ctx.user, c);
  return {
    id: c.id,
    name: c.name,
    grade: c.grade,
    teacher_name: ctx.users.find((u) => u.id === c.teacher_id)?.full_name ?? "",
    ...(owner ? { join_code: c.join_code } : {}),
    member_count: c.members.size,
    assignment_count: mine.length,
    pending_count: owner ? 0 : mine.filter((a) => ["todo", "in_progress"].includes(statusOf(a, examOf(ctx, a.id, ctx.user.id)))).length,
    created_at: c.created_at,
  };
}

function assignmentOut(ctx: Ctx, a: MockAssignment, c: MockClass): Assignment {
  const { questions: _q, ...base } = a;
  if (owns(ctx.user, c)) {
    const scores = [...c.members.keys()].flatMap((uid) => {
      const e = examOf(ctx, a.id, uid);
      return e?.result ? [e.result.score] : [];
    });
    return { ...base, class_name: c.name, member_count: c.members.size, submitted_count: scores.length, average_score: mean(scores) };
  }
  const e = examOf(ctx, a.id, ctx.user.id);
  return { ...base, class_name: c.name, status: statusOf(a, e), exam_id: e?.id ?? null, score: e?.result?.score ?? null };
}

function detailOut(ctx: Ctx, c: MockClass): ClassDetail {
  const detail: ClassDetail = classOut(ctx, c);
  if (owns(ctx.user, c)) {
    detail.members = ctx.users
      .filter((u) => c.members.has(u.id))
      .map((u) => ({ id: u.id, full_name: u.full_name, email: u.email, grade: u.grade, joined_at: c.members.get(u.id)! }))
      .sort((x, y) => x.full_name.localeCompare(y.full_name));
  }
  return detail;
}

function visible(ctx: Ctx, classId: string) {
  const c = store().classes.get(classId);
  return c && (owns(ctx.user, c) || c.members.has(ctx.user.id)) ? c : null;
}

function report(ctx: Ctx, a: MockAssignment, c: MockClass): AssignmentReport {
  const members = ctx.users.filter((u) => c.members.has(u.id));
  const order: Record<AssignmentStatus, number> = { submitted: 0, late: 0, in_progress: 1, todo: 2, missed: 3 };
  const students = members
    .map((m) => {
      const e = examOf(ctx, a.id, m.id);
      const submitted = e?.result?.submitted_at ?? null;
      return {
        id: m.id,
        full_name: m.full_name,
        status: statusOf(a, e),
        exam_id: e?.id ?? null,
        score: e?.result?.score ?? null,
        correct: e?.result?.correct ?? null,
        total: a.size,
        started_at: e?.created_at ?? null,
        submitted_at: submitted,
        duration_seconds: e && submitted ? Math.round((new Date(submitted).getTime() - new Date(e.created_at).getTime()) / 1000) : null,
      };
    })
    .sort((x, y) => order[x.status] - order[y.status] || (y.score ?? 0) - (x.score ?? 0) || x.full_name.localeCompare(y.full_name));

  const done = members.map((m) => examOf(ctx, a.id, m.id)).filter((e): e is MockExam => !!e?.result);
  const earned = new Map<number, { sum: number; n: number }>();
  for (const e of done) {
    for (const item of e.result!.items) {
      const i = e.questions.find((q) => q.id === item.question_id)?.source_index;
      if (i === undefined) continue;
      const cur = earned.get(i) ?? { sum: 0, n: 0 };
      earned.set(i, { sum: cur.sum + item.points, n: cur.n + 1 });
    }
  }
  const questions: QuestionStat[] = a.questions.map((q, k) => {
    const st = earned.get(k + 1);
    return {
      index: k + 1,
      type: q.type,
      statement: q.statement,
      template: q.template,
      skill: q.skill,
      answer_display: q.answer_display,
      correct_rate: st ? st.sum / st.n : null,
      answered: st?.n ?? 0,
    };
  });
  const bySkill = new Map<string, QuestionStat[]>();
  for (const q of questions) bySkill.set(q.skill.code, [...(bySkill.get(q.skill.code) ?? []), q]);
  const skills = [...bySkill.values()]
    .map((qs) => {
      const n = qs.reduce((t, q) => t + q.answered, 0);
      const sum = qs.reduce((t, q) => t + (earned.get(q.index)?.sum ?? 0), 0);
      return { skill: qs[0].skill, questions: qs.length, correct_rate: n ? sum / n : null };
    })
    .sort((x, y) => Number(x.correct_rate === null) - Number(y.correct_rate === null) || (x.correct_rate ?? 0) - (y.correct_rate ?? 0));

  const scores = done.map((e) => e.result!.score);
  const distribution = [0, 0, 0, 0, 0];
  for (const sc of scores) distribution[Math.min(Math.floor(sc / 2), 4)] += 1;
  const average = mean(scores);
  return {
    assignment: { ...assignmentOut(ctx, a, c) },
    summary: {
      member_count: members.length,
      submitted_count: done.length,
      late_count: students.filter((s) => s.status === "late").length,
      average_score: average,
      max_score: scores.length ? Math.max(...scores) : null,
      min_score: scores.length ? Math.min(...scores) : null,
      distribution,
    },
    students,
    questions,
    skills,
  };
}

/** Trộn thứ tự câu trong từng phần, giữ vị trí gốc để báo cáo thống kê theo câu. */
function shuffled(source: ExamSource[], shuffle: boolean) {
  const indexed = source.map((q, i) => ({ ...q, source_index: i + 1 }));
  if (!shuffle) return indexed;
  const groups = new Map<string, typeof indexed>();
  for (const q of indexed) groups.set(q.type, [...(groups.get(q.type) ?? []), q]);
  return [...groups.values()].flatMap((qs) => {
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]];
    }
    return qs;
  });
}

/** Bài giao của học sinh `ctx.user` ở mọi lớp: bài còn phải làm lên trước, hạn gần trước. */
export function myAssignments(ctx: Ctx): Assignment[] {
  const { classes, assignments } = store();
  const mine = [...classes.values()].filter((c) => c.members.has(ctx.user.id));
  const out = mine.flatMap((c) => [...assignments.values()].filter((a) => a.class_id === c.id).map((a) => assignmentOut(ctx, a, c)));
  out.sort((x, y) => y.created_at.localeCompare(x.created_at));
  const open = out.filter((a) => a.status === "todo" || a.status === "in_progress");
  open.sort((x, y) => Number(!x.due_at) - Number(!y.due_at) || (x.due_at ?? x.created_at).localeCompare(y.due_at ?? y.created_at));
  return [...open, ...out.filter((a) => !open.includes(a))];
}

export function handleClassroom(req: Request, path: string[], body: Record<string, unknown> | null, ctx: Ctx): Response | null {
  const { classes, assignments } = store();
  const { user } = ctx;
  const m = req.method;
  const [p0, p1, p2, p3] = path.map(decodeURIComponent);

  if (p0 === "me" && p1 === "assignments" && m === "GET") return json(myAssignments(ctx));

  if (p0 === "classes") {
    if (!p1) {
      if (m === "GET") {
        const list = [...classes.values()]
          .filter((c) => (isTeacher(user) ? c.teacher_id === user.id : c.members.has(user.id)))
          .sort((x, y) => y.created_at.localeCompare(x.created_at));
        return json(list.map((c) => classOut(ctx, c)));
      }
      if (m === "POST") {
        if (!isTeacher(user)) return fail(403, "forbidden");
        const name = String(body?.name ?? "").trim();
        if (name.length < 2) return fail(422, "validation_error");
        const c: MockClass = {
          id: newId("cls"),
          teacher_id: user.id,
          name,
          grade: (body?.grade as number | null) ?? null,
          join_code: newCode(),
          created_at: new Date().toISOString(),
          members: new Map(),
        };
        classes.set(c.id, c);
        return json(classOut(ctx, c), 201);
      }
    }
    if (p1 === "join" && m === "POST") {
      if (user.role !== "student") return fail(403, "forbidden");
      const code = String(body?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const c = [...classes.values()].find((x) => x.join_code === code);
      if (!c) return fail(404, "class_not_found");
      if (!c.members.has(user.id)) c.members.set(user.id, new Date().toISOString());
      return json(classOut(ctx, c));
    }

    const c = p1 ? visible(ctx, p1) : null;
    if (!c) return fail(404, "not_found");
    const owner = owns(user, c);

    if (!p2) {
      if (m === "GET") return json(detailOut(ctx, c));
      if (m === "DELETE") {
        if (!owner) return fail(isTeacher(user) ? 404 : 403, isTeacher(user) ? "not_found" : "forbidden");
        classes.delete(c.id);
        for (const a of assignments.values()) if (a.class_id === c.id) assignments.delete(a.id);
        return noContent();
      }
    }
    if (p2 === "code" && m === "POST") {
      if (!owner) return fail(403, "forbidden");
      c.join_code = newCode();
      return json(detailOut(ctx, c));
    }
    if (p2 === "members" && p3 && m === "DELETE") {
      if (p3 !== user.id && !owner) return fail(404, "not_found");
      c.members.delete(p3);
      return noContent();
    }
    if (p2 === "leaderboard" && m === "GET") {
      const rows: LeaderboardRow[] = ctx.users
        .filter((u) => c.members.has(u.id))
        .map((u) => {
          const scores = [...assignments.values()]
            .filter((a) => a.class_id === c.id)
            .flatMap((a) => {
              const e = examOf(ctx, a.id, u.id);
              return e?.result ? [e.result.score] : [];
            });
          const act = ctx.activity(u.id);
          return {
            id: u.id,
            full_name: u.full_name,
            is_me: u.id === user.id,
            average_score: mean(scores),
            assignments_done: scores.length,
            week_problems: act.week,
            streak_days: act.streak,
          };
        })
        .sort((x, y) => (y.average_score ?? -1) - (x.average_score ?? -1) || y.week_problems - x.week_problems);
      return json(rows);
    }
    if (p2 === "assignments") {
      if (m === "GET") {
        const list = [...assignments.values()].filter((a) => a.class_id === c.id).sort((x, y) => y.created_at.localeCompare(x.created_at));
        return json(list.map((a) => assignmentOut(ctx, a, c)));
      }
      if (m === "POST") {
        if (!owner) return fail(403, "forbidden");
        const b = (body ?? {}) as unknown as CreateAssignmentRequest;
        if (b.due_at && new Date(b.due_at).getTime() <= Date.now()) return fail(422, "due_in_past");
        const official = b.kind === "official" && !b.problem_set_id;
        const fromSet = b.problem_set_id ? ctx.setSource(b.problem_set_id) : null;
        const built =
          fromSet ?? ctx.buildSource(official ? { kind: "official", blueprint: "thpt" } : { mode: b.mode, size: b.size, skills: b.skills });
        if (built instanceof Response) return built;
        const defaultTitle =
          fromSet && !(fromSet instanceof Response)
            ? fromSet.title
            : official
              ? "Đề thi tốt nghiệp THPT · Môn Toán"
              : `Bài tập ${b.mode === "choice" ? "trắc nghiệm" : "tự luận"} · ${built.source.length} câu`;
        const a: MockAssignment = {
          id: newId("asg"),
          class_id: c.id,
          title: b.title?.trim() || defaultTitle,
          kind: official ? "official" : "practice",
          mode: built.mode,
          size: built.source.length,
          duration_minutes: official ? THPT_BLUEPRINT.duration_minutes : (b.duration_minutes ?? null),
          due_at: b.due_at ?? null,
          shuffle: !!b.shuffle,
          created_at: new Date().toISOString(),
          questions: built.source,
        };
        assignments.set(a.id, a);
        return json(assignmentOut(ctx, a, c), 201);
      }
    }
    return fail(404, "not_found");
  }

  if (p0 === "assignments" && p1) {
    const a = assignments.get(p1);
    const c = a ? classes.get(a.class_id) : undefined;
    if (!a || !c) return fail(404, "not_found");
    const owner = owns(user, c);

    if (p2 === "start" && m === "POST") {
      if (!c.members.has(user.id)) return fail(404, "not_found");
      const existing = examOf(ctx, a.id, user.id);
      if (existing) return json({ exam_id: existing.id });
      const now = Date.now();
      if (a.due_at && now > new Date(a.due_at).getTime()) return fail(422, "assignment_closed");
      let ends = a.duration_minutes ? now + a.duration_minutes * 60_000 : null;
      if (ends && a.due_at) ends = Math.min(ends, new Date(a.due_at).getTime());
      const exam = ctx.addExam(
        user.id,
        { title: a.title, kind: a.kind, mode: a.mode, duration_minutes: a.duration_minutes, ends_at: ends ? new Date(ends).toISOString() : null, assignment_id: a.id },
        shuffled(a.questions, a.shuffle),
      );
      return json({ exam_id: exam.id });
    }
    if (!isTeacher(user)) return fail(403, "forbidden");
    if (!owner) return fail(404, "not_found");
    if (!p2 && m === "DELETE") {
      assignments.delete(a.id);
      for (const e of ctx.exams.values()) if (e.assignment_id === a.id) e.assignment_id = null;
      return noContent();
    }
    if (p2 === "report" && m === "GET") return json(report(ctx, a, c));
    if (p2 === "submissions" && p3 && m === "GET") {
      const e = examOf(ctx, a.id, p3);
      return e?.result ? json(ctx.publicExam(e)) : fail(404, "not_found");
    }
  }
  return null;
}
