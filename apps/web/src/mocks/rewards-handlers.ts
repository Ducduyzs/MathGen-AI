// Mock phần thưởng: XP, nhiệm vụ hằng ngày, đóng băng chuỗi, huy hiệu (rút gọn từ learning/rewards.py).
import type { BadgeInfo, CalendarDay, Quest, Rewards } from "@/types/api";

type Kind = "practice" | "exam" | "arena";
type Metric = "count" | "correct" | "xp" | "best_combo" | "exams" | "arena_runs";

interface Day {
  count: number;
  correct: number;
  xp: number;
  combo: number;
  best_combo: number;
  exams: number;
  arena_runs: number;
  quests: string[];
}

interface Profile {
  xp: number;
  correct: number;
  freezes: number;
  longest: number;
  badges: Map<string, string>;
  date: string;
  day: Day;
}

/** Bộ đếm ngày dùng chung với tiến độ (mock coi mọi ngày trước là chuỗi liền nhau). */
export interface Daily {
  count: number;
  streakBefore: number;
}

const XP_CORRECT = 10;
const XP_HINTED = 5;
const XP_TRIED = 2;
const XP_GOAL = 20;
const MAX_FREEZES = 2;
const FREEZE_EVERY = 7;

const q = (code: string, title: string, metric: Metric, target: number, reward: number) => ({ code, title, metric, target, reward });
const TIERS = [
  [q("answered_10", "Làm 10 câu", "count", 10, 10), q("correct_5", "Làm đúng 5 câu", "correct", 5, 10), q("xp_50", "Kiếm 50 XP", "xp", 50, 10)],
  [
    q("correct_10", "Làm đúng 10 câu", "correct", 10, 20),
    q("combo_5", "Đúng 5 câu liên tiếp", "best_combo", 5, 20),
    q("arena_1", "Chơi một lượt Đấu trường", "arena_runs", 1, 20),
  ],
  [
    q("correct_20", "Làm đúng 20 câu", "correct", 20, 30),
    q("combo_8", "Đúng 8 câu liên tiếp", "best_combo", 8, 30),
    q("exam_1", "Nộp một đề", "exams", 1, 30),
    q("xp_150", "Kiếm 150 XP", "xp", 150, 30),
  ],
];

interface Stats {
  xp: number;
  correct: number;
  streak: number;
  day: Day;
}
const b = (code: string, title: string, description: string, earned: (s: Stats) => boolean) => ({ code, title, description, earned });
const BADGES = [
  b("first_correct", "Khởi đầu", "Làm đúng câu đầu tiên", (s) => s.correct >= 1),
  b("streak_7", "Một tuần bền bỉ", "Giữ chuỗi 7 ngày học", (s) => s.streak >= 7),
  b("streak_30", "Một tháng kiên trì", "Giữ chuỗi 30 ngày học", (s) => s.streak >= 30),
  b("streak_100", "Trăm ngày", "Giữ chuỗi 100 ngày học", (s) => s.streak >= 100),
  b("correct_100", "Trăm câu đúng", "Làm đúng 100 câu", (s) => s.correct >= 100),
  b("correct_1000", "Nghìn câu đúng", "Làm đúng 1.000 câu", (s) => s.correct >= 1000),
  b("combo_10", "Mười liên tiếp", "Đúng 10 câu liên tiếp", (s) => s.day.best_combo >= 10),
  b("quests_all", "Trọn nhiệm vụ", "Xong cả 3 nhiệm vụ trong một ngày", (s) => s.day.quests.length >= 3),
  b("first_exam", "Sĩ tử", "Nộp đề đầu tiên", (s) => s.day.exams >= 1),
  b("first_arena", "Đấu sĩ", "Hoàn thành lượt Đấu trường đầu tiên", (s) => s.day.arena_runs >= 1),
  b("xp_1000", "Chăm chỉ", "Đạt 1.000 XP", (s) => s.xp >= 1000),
  b("mastery", "Thành thạo", "Đạt 85% ở một kỹ năng", () => false),
];

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const emptyDay = (): Day => ({ count: 0, correct: 0, xp: 0, combo: 0, best_combo: 0, exams: 0, arena_runs: 0, quests: [] });

function questsOf(userId: string, day: string) {
  let h = 0;
  for (const ch of `${userId}:${day}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TIERS.map((tier, i) => tier[(h >>> (i * 4)) % tier.length]);
}

const g = globalThis as unknown as { __mathgenRewards?: Map<string, Profile> };
function profileOf(userId: string): Profile {
  const all = (g.__mathgenRewards ??= new Map());
  const today = isoDay(new Date());
  // Học sinh mẫu có sẵn chút XP và huy hiệu để trang Thành tích không trống
  const p = all.get(userId) ?? {
    xp: userId === "u_student" ? 640 : 0,
    correct: userId === "u_student" ? 58 : 0,
    freezes: 1,
    longest: 0,
    badges: new Map(userId === "u_student" ? [["first_correct", new Date(Date.now() - 6 * 86400_000).toISOString()]] : []),
    date: today,
    day: emptyDay(),
  };
  if (p.date !== today) {
    p.date = today;
    p.day = emptyDay();
  }
  all.set(userId, p);
  return p;
}

const streakOf = (d: Daily, goal: number) => d.streakBefore + (d.count >= goal ? 1 : 0);

/** Ghi các câu vừa làm: cộng bộ đếm ngày, XP, nhiệm vụ, huy hiệu. Trả về XP nhận được. */
export function recordRewards(userId: string, results: boolean[], kind: Kind, daily: Daily, goal: number, hints = 0): number {
  if (!results.length) return 0;
  const p = profileOf(userId);
  const day = p.day;
  const correct = results.filter(Boolean).length;
  let xp = results.reduce((s, ok) => s + (ok ? (hints ? XP_HINTED : XP_CORRECT) : XP_TRIED), 0);
  const before = daily.count;
  daily.count += results.length;
  day.count += results.length;
  day.correct += correct;
  let run = 0;
  for (const ok of results) {
    run = ok ? run + 1 : 0;
    if (kind === "practice") day.combo = ok ? day.combo + 1 : 0;
    day.best_combo = Math.max(day.best_combo, kind === "practice" ? day.combo : run);
  }
  if (kind === "exam") day.exams += 1;
  if (kind === "arena") day.arena_runs += 1;

  const streak = streakOf(daily, goal);
  if (before < goal && daily.count >= goal) {
    xp += XP_GOAL;
    if (streak % FREEZE_EVERY === 0 && p.freezes < MAX_FREEZES) p.freezes += 1;
  }
  day.xp += xp;
  for (let changed = true; changed; ) {
    changed = false;
    for (const quest of questsOf(userId, p.date)) {
      if (!day.quests.includes(quest.code) && day[quest.metric] >= quest.target) {
        day.quests.push(quest.code);
        day.xp += quest.reward;
        xp += quest.reward;
        changed = true;
      }
    }
  }
  p.xp += xp;
  p.correct += correct;
  p.longest = Math.max(p.longest, streak);
  const stats = { xp: p.xp, correct: p.correct, streak, day };
  for (const badge of BADGES) if (!p.badges.has(badge.code) && badge.earned(stats)) p.badges.set(badge.code, new Date().toISOString());
  return xp;
}

export function rewardsOf(userId: string, daily: Daily, goal: number): Rewards {
  const p = profileOf(userId);
  const streak = streakOf(daily, goal);
  const now = new Date();
  const calendar: CalendarDay[] = Array.from({ length: 35 }, (_, i) => {
    const ago = 34 - i;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
    if (ago === 0) return { day: isoDay(d), count: daily.count, status: daily.count >= goal ? "met" : daily.count ? "partial" : "none" };
    return { day: isoDay(d), count: ago <= daily.streakBefore ? goal : 0, status: ago <= daily.streakBefore ? "met" : "none" };
  });
  const quests: Quest[] = questsOf(userId, p.date).map(({ metric, ...quest }) => ({
    ...quest,
    progress: Math.min(p.day[metric], quest.target),
    done: p.day.quests.includes(quest.code),
  }));
  const badges: BadgeInfo[] = BADGES.map(({ earned: _e, ...badge }) => ({ ...badge, earned_at: p.badges.get(badge.code) ?? null }));
  return {
    today: p.date,
    xp_total: p.xp,
    xp_today: p.day.xp,
    daily_goal: goal,
    today_attempts: daily.count,
    streak_days: streak,
    longest_streak: Math.max(p.longest, streak),
    freezes: p.freezes,
    max_freezes: MAX_FREEZES,
    freeze_every: FREEZE_EVERY,
    quests,
    badges,
    calendar,
  };
}
