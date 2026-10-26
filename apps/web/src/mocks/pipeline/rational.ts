// Số hữu tỉ chính xác (tử/mẫu nguyên, mẫu > 0, tối giản). Toàn bộ pipeline tính bằng kiểu này
// để không có sai số dấu phẩy động — tương đương sympy.Rational ở backend Python.

export interface Q {
  n: number;
  d: number;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);

export function q(n: number, d = 1): Q {
  if (d === 0) throw new Error("Chia cho 0");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g || 0, d: d / g };
}

export const ZERO = q(0);
export const ONE = q(1);

export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const neg = (a: Q) => q(-a.n, a.d);
export function div(a: Q, b: Q) {
  if (b.n === 0) throw new Error("Chia cho 0");
  return q(a.n * b.d, a.d * b.n);
}
export const isZero = (a: Q) => a.n === 0;
export const isInt = (a: Q) => a.d === 1;
export const eq = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
/** < 0 nếu a < b, 0 nếu bằng, > 0 nếu a > b. */
export const cmp = (a: Q, b: Q) => a.n * b.d - b.n * a.d;
export const sign = (a: Q) => Math.sign(a.n);
export const abs = (a: Q) => q(Math.abs(a.n), a.d);
export const toNumber = (a: Q) => a.n / a.d;
export const floor = (a: Q) => Math.floor(a.n / a.d);
export const ceil = (a: Q) => Math.ceil(a.n / a.d);

/** "1,5" hoặc "1.5" → 3/2. */
export function fromDecimal(s: string): Q {
  const [int, frac = ""] = s.replace(",", ".").split(".");
  return q(Number(int + frac), 10 ** frac.length);
}

/** LaTeX: 5, -\dfrac{3}{2}. */
export function latex(a: Q) {
  if (a.d === 1) return `${a.n}`;
  return a.n < 0 ? `-\\dfrac{${-a.n}}{${a.d}}` : `\\dfrac{${a.n}}{${a.d}}`;
}

/** Dạng chấm điểm: 5, -3/2. */
export const plain = (a: Q) => (a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`);

/** Căn bậc hai đúng của số hữu tỉ không âm, null nếu không phải số chính phương. */
export function sqrtExact(a: Q): Q | null {
  if (a.n < 0) return null;
  const sn = Math.round(Math.sqrt(a.n));
  const sd = Math.round(Math.sqrt(a.d));
  return sn * sn === a.n && sd * sd === a.d ? q(sn, sd) : null;
}

/** √N = k√r với r không chứa thừa số chính phương. */
export function simplifySqrt(N: number): { k: number; r: number } {
  let k = 1;
  let r = N;
  for (let f = 2; f * f <= r; f++) {
    while (r % (f * f) === 0) {
      r /= f * f;
      k *= f;
    }
  }
  return { k, r };
}
