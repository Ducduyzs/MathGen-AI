// Bậc rank Đấu trường cho mock (cùng công thức với apps/api/app/modules/arena/ranks.py).
import type { ArenaRank, RankTier } from "@/types/api";

const TIERS: [RankTier, string, number][] = [
  ["bronze", "Đồng", 0],
  ["silver", "Bạc", 400],
  ["gold", "Vàng", 900],
  ["platinum", "Bạch kim", 1500],
  ["diamond", "Kim cương", 2200],
  ["master", "Cao thủ", 3000],
];
const DIVISIONS = ["III", "II", "I"] as const;
const MIN_ANSWERED = 3;

export function rankDelta(points: number, score: number, answered: number, duration: number): number | null {
  if (answered < MIN_ANSWERED) return null;
  const weight = Math.sqrt(duration / 5);
  const raw = (score / duration - (20 + points / 60)) * 1.2 * weight;
  return Math.max(-Math.round(25 * weight), Math.min(Math.round(40 * weight), Math.round(raw)));
}

export function describeRank(points: number, rankedRuns = 0): ArenaRank {
  const i = TIERS.reduce((k, t, idx) => (points >= t[2] ? idx : k), 0);
  const [tier, name, start] = TIERS[i];
  if (i === TIERS.length - 1) {
    return { points, tier, tier_name: name, division: null, label: name, floor: start, next_at: null, ranked_runs: rankedRuns };
  }
  const size = (TIERS[i + 1][2] - start) / 3;
  const d = Math.min(2, Math.floor((points - start) / size));
  return {
    points,
    tier,
    tier_name: name,
    division: DIVISIONS[d],
    label: `${name} ${DIVISIONS[d]}`,
    floor: Math.round(start + d * size),
    next_at: Math.round(start + (d + 1) * size),
    ranked_runs: rankedRuns,
  };
}

interface Rating {
  points: number;
  ranked_runs: number;
}

const g = globalThis as unknown as { __mathgenRatings?: Map<string, Rating> };
export const ratings = () => (g.__mathgenRatings ??= new Map());
export const ratingOf = (userId: string): Rating => ratings().get(userId) ?? { points: 0, ranked_runs: 0 };
