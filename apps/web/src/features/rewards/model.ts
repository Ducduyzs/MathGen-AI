import type { LucideIcon } from "lucide-react";
import { Award, CircleCheckBig, Crown, Flame, GraduationCap, ListChecks, Rocket, Sparkles, Star, Swords } from "lucide-react";

export const BADGE_ICON: Record<string, LucideIcon> = {
  first_correct: Sparkles,
  streak_7: Flame,
  streak_30: Flame,
  streak_100: Flame,
  correct_100: CircleCheckBig,
  correct_1000: CircleCheckBig,
  combo_10: Rocket,
  quests_all: ListChecks,
  first_exam: GraduationCap,
  first_arena: Swords,
  xp_1000: Star,
  mastery: Crown,
};

export const badgeIcon = (code: string) => BADGE_ICON[code] ?? Award;

const number = new Intl.NumberFormat("vi-VN");
export const formatXp = (xp: number) => `${number.format(xp)} XP`;

/** "2026-10-27" → "27/10" */
export const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Thứ trong tuần, tuần bắt đầu thứ Hai: 0 = T2 … 6 = CN. */
export const weekdayMon = (iso: string) => (new Date(`${iso}T00:00:00`).getDay() + 6) % 7;
