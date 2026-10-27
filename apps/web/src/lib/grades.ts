import type { Skill } from "@/types/api";

/** Lớp 1–12; tiểu học là lớp 1–5. */
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const PRIMARY_MAX_GRADE = 5;

/** Học sinh tiểu học. Chưa có lớp thì coi như từ lớp 6 (giống backend). */
export const isPrimary = (grade: number | null | undefined) => grade != null && grade <= PRIMARY_MAX_GRADE;

/** Kỹ năng cùng cấp học với học sinh (tiểu học / từ lớp 6). */
export const skillInStage = (skill: Skill, grade: number | null | undefined) => ((skill.grade_max ?? 12) <= PRIMARY_MAX_GRADE) === isPrimary(grade);
