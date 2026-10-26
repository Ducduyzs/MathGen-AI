// Đa thức hai biến x (ẩn) và m (tham số) với hệ số hữu tỉ. Khóa "i,j" ứng với x^i·m^j.
import { add, isZero, latex, mul, neg, ONE, type Q, ZERO } from "./rational";

export type Poly = Map<string, Q>;

const key = (ex: number, em: number) => `${ex},${em}`;
const exps = (k: string) => k.split(",").map(Number) as [number, number];

export const constP = (c: Q): Poly => (isZero(c) ? new Map() : new Map([[key(0, 0), c]]));
export const varP = (v: "x" | "m"): Poly => new Map([[v === "x" ? key(1, 0) : key(0, 1), ONE]]);

export function addP(a: Poly, b: Poly): Poly {
  const out = new Map(a);
  for (const [k, c] of b) {
    const s = add(out.get(k) ?? ZERO, c);
    if (isZero(s)) out.delete(k);
    else out.set(k, s);
  }
  return out;
}

export const negP = (a: Poly): Poly => new Map([...a].map(([k, c]) => [k, neg(c)]));
export const subP = (a: Poly, b: Poly) => addP(a, negP(b));

export function mulP(a: Poly, b: Poly): Poly {
  let out: Poly = new Map();
  for (const [ka, ca] of a) {
    const [xa, ma] = exps(ka);
    for (const [kb, cb] of b) {
      const [xb, mb] = exps(kb);
      out = addP(out, new Map([[key(xa + xb, ma + mb), mul(ca, cb)]]));
    }
  }
  return out;
}

export const scaleP = (a: Poly, c: Q) => mulP(a, constP(c));

export function powP(a: Poly, n: number): Poly {
  let out = constP(ONE);
  for (let i = 0; i < n; i++) out = mulP(out, a);
  return out;
}

export const isConst = (a: Poly) => [...a.keys()].every((k) => k === "0,0");
export const constOf = (a: Poly) => a.get("0,0") ?? ZERO;
export const degX = (a: Poly) => Math.max(0, ...[...a.keys()].map((k) => exps(k)[0]));
export const degM = (a: Poly) => Math.max(0, ...[...a.keys()].map((k) => exps(k)[1]));
export const coef = (a: Poly, ex: number, em = 0) => a.get(key(ex, em)) ?? ZERO;

/** Hệ số theo x, bậc giảm dần (đa thức không chứa m). */
export function coeffsX(a: Poly): Q[] {
  const d = degX(a);
  return Array.from({ length: d + 1 }, (_, i) => coef(a, d - i));
}

/** Đa thức một biến từ mảng hệ số bậc giảm dần. */
export function fromCoeffs(cs: Q[]): Poly {
  let out: Poly = new Map();
  cs.forEach((c, i) => {
    out = addP(out, scaleP(powP(varP("x"), cs.length - 1 - i), c));
  });
  return out;
}

export function evalX(a: Poly, x: Q): Q {
  let out = ZERO;
  for (const [k, c] of a) {
    const [ex] = exps(k);
    let term = c;
    for (let i = 0; i < ex; i++) term = mul(term, x);
    out = add(out, term);
  }
  return out;
}

/** LaTeX theo thứ tự bậc x giảm dần: x^2 - 5x + 6, \dfrac{1}{2}x - m. */
export function polyLatex(a: Poly): string {
  const terms = [...a].sort(([k1], [k2]) => {
    const [x1, m1] = exps(k1);
    const [x2, m2] = exps(k2);
    return x2 - x1 || m2 - m1;
  });
  if (!terms.length) return "0";
  return terms
    .map(([k, c], i) => {
      const [ex, em] = exps(k);
      const mono = (ex ? (ex === 1 ? "x" : `x^${ex}`) : "") + (em ? (em === 1 ? "m" : `m^${em}`) : "");
      const absC = c.n < 0 ? neg(c) : c;
      const coefStr = mono && absC.n === 1 && absC.d === 1 ? "" : latex(absC);
      const body = `${coefStr}${mono}`;
      if (i === 0) return c.n < 0 ? `-${body}` : body;
      return c.n < 0 ? ` - ${body}` : ` + ${body}`;
    })
    .join("");
}
