// Xuất dữ liệu mẫu của mock sang JSON cho backend (apps/api/app/seed/data.json) — một nguồn dữ liệu duy nhất.
// Chạy: npm run seed:export
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DAILY_GOAL, PROBLEMS, REVIEW_QUEUE, SEED_DAILY, SEED_SCORES, SKILLS, USERS } from "../src/mocks/data";

const out = resolve("../api/app/seed/data.json");
const data = {
  skills: SKILLS.map((s, i) => ({ code: s.code, name: s.name, sort: i, grade_min: s.grade_min ?? 6, grade_max: s.grade_max ?? 12 })),
  problems: PROBLEMS.map((p) => ({
    id: p.id, statement: p.statement, grade: p.grade, skill_code: p.skill.code, difficulty: p.difficulty,
    answer_type: p.answer_type, answer_prefix: p.answer_prefix ?? null, choices: p.choices ?? null, hints: p.hints ?? null,
    answer: p.answer, answer_display: p.answer_display, solution: p.solution,
  })),
  // Chỉ dùng ở môi trường dev (seed --demo); mật khẩu được băm khi seed.
  demo_users: USERS.map(({ id, ...u }) => ({ key: id, ...u })),
  demo_scores: SEED_SCORES,
  demo_daily: { ...SEED_DAILY, goal: DAILY_GOAL },
  review_items: REVIEW_QUEUE.map(({ skill, ...r }) => ({ ...r, skill_code: skill.code })),
};
writeFileSync(out, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`→ ${out}: ${data.skills.length} kỹ năng, ${data.problems.length} bài, ${data.review_items.length} bài chờ duyệt, ${data.demo_users.length} tài khoản thử`);
