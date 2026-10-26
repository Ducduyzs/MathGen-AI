// Dạng chuẩn để chống trùng: hai đề khác chữ nhưng tương đương toán học (x² + 2x − 3 = 0 và 2x + x² = 3,
// hay 2x² − 10x + 12 = 0 và x² − 5x + 6 = 0) cho cùng một khóa → cùng một mã băm.
import type { Rel } from "./parse";
import { coeffsX, degM, degX, type Poly, polyLatex } from "./poly";
import { gcd, lcm, plain, q, toNumber } from "./rational";
import { REL_LATEX, type Structure } from "./structure";

const FLIP: Record<Rel, Rel> = { "=": "=", "<": ">", ">": "<", "<=": ">=", ">=": "<=" };

/** Quy đồng → chia ước chung → hệ số đầu dương. Trả về các hạng tử nguyên và việc có đổi dấu hay không. */
function integerForm(P: Poly) {
  const list = [...P].sort(([a], [b]) => {
    const [xa, ma] = a.split(",").map(Number);
    const [xb, mb] = b.split(",").map(Number);
    return xb - xa || mb - ma;
  });
  const L = list.reduce((acc, [, c]) => lcm(acc, c.d), 1);
  let ints = list.map(([k, c]) => [k, (c.n * L) / c.d] as [string, number]);
  const G = ints.reduce((g, [, v]) => gcd(g, v), 0) || 1;
  ints = ints.map(([k, v]) => [k, v / G]);
  const flipped = (ints[0]?.[1] ?? 0) < 0;
  if (flipped) ints = ints.map(([k, v]) => [k, -v]);
  return { ints, flipped };
}

const enc = (ints: [string, number][]) => ints.map(([k, v]) => `${k}:${v}`).join("|");
const raw = (P: Poly) => [...P].sort(([a], [b]) => a.localeCompare(b)).map(([k, c]) => `${k}:${plain(c)}`).join("|");

export function canonicalKey(s: Structure): string {
  switch (s.kind) {
    case "linear_equation":
    case "quadratic_equation":
      return `eq:${enc(integerForm(s.P).ints)}`;
    case "quadratic_param":
      return `par:${s.cond}:${enc(integerForm(s.P).ints)}`;
    case "linear_inequality":
    case "quadratic_inequality": {
      const { ints, flipped } = integerForm(s.P);
      return `ineq:${flipped ? FLIP[s.rel!] : s.rel}:${enc(ints)}`;
    }
    case "factorization":
      return `fac:${enc(integerForm(s.P).ints)}`;
    case "function_value":
      return `fv:${raw(s.P)}@${plain(s.t!)}`;
    case "vertex":
      return `vx:${raw(s.P)}`;
    case "min_value":
      return `ext:${s.extreme}:${raw(s.P)}`;
  }
}

/** Mã băm FNV-1a 32 bit (backend dùng SHA-256 trên cùng khóa chuẩn). */
export function hashKey(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Dạng chuẩn hiển thị, ví dụ x^2 - 5x + 6 = 0. */
export function canonicalLatex(s: Structure): string {
  if (s.kind === "function_value" || s.kind === "vertex" || s.kind === "min_value") return `y = ${polyLatex(s.P)}`;
  const { ints, flipped } = integerForm(s.P);
  const P: Poly = new Map(ints.map(([k, v]) => [k, q(v)]));
  if (s.kind === "factorization") return polyLatex(P);
  const rel = s.rel ?? "=";
  return `${polyLatex(P)} ${REL_LATEX[flipped ? FLIP[rel] : rel]} 0`;
}

const BASE: Record<Structure["kind"], number> = {
  linear_equation: 0.2,
  quadratic_equation: 0.4,
  quadratic_param: 0.62,
  linear_inequality: 0.3,
  quadratic_inequality: 0.55,
  factorization: 0.3,
  function_value: 0.18,
  vertex: 0.45,
  min_value: 0.5,
};

/**
 * Ước lượng độ khó 0–1 từ đặc trưng cấu trúc: dạng bài, hệ số phân số, hệ số lớn,
 * hệ số đầu khác 1, có tham số, câu hỏi phụ (đếm nghiệm nguyên…).
 */
export function estimateDifficulty(s: Structure): number {
  let d = BASE[s.kind];
  const cs = degM(s.P) ? [...s.P.values()] : coeffsX(s.P);
  if (cs.some((c) => c.d !== 1)) d += 0.12;
  if (cs.some((c) => Math.abs(toNumber(c)) > 12)) d += 0.06;
  const lead = cs[0];
  if (degX(s.P) >= 2 && lead && Math.abs(toNumber(lead)) !== 1) d += 0.08;
  if (s.kind.endsWith("inequality") && lead && lead.n < 0) d += 0.06;
  if (s.ask !== "solve") d += 0.05;
  if (degX(s.P) === 3) d += 0.08;
  return Math.round(Math.min(0.95, Math.max(0.05, d)) * 100) / 100;
}
