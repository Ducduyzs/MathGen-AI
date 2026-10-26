// Giải chính xác từng dạng bài và tự kiểm chứng kết quả (thế ngược nghiệm, thử điểm, Vi-ét, nhân lại nhân tử).
// Backend Python: sympy.solve / solveset / factor cho cùng các dạng.
import type { VerificationCheck } from "@/types/api";
import type { Rel } from "./parse";
import { addP, coef, coeffsX, constP, degX, evalX, fromCoeffs, mulP, type Poly, polyLatex, scaleP, varP } from "./poly";
import {
  abs, add, ceil, cmp, div, eq, floor, isInt, isZero, latex, mul, neg, ONE, plain, q, type Q, sign, simplifySqrt,
  sqrtExact, sub, ZERO,
} from "./rational";
import { REL_LATEX, type Structure } from "./structure";

export class SolveError extends Error {}

export interface Solved {
  /** Khóa so sánh đáp án (dùng cho kiểm chứng ngược và chấm). */
  key: string;
  /** Đáp án hiển thị, có $...$. */
  display: string;
  steps: string[];
  /** Đáp số một số (khi câu hỏi yêu cầu một số). */
  short?: Q;
  shortLabel?: string;
  /** Nội dung khi làm phương án trắc nghiệm (mặc định = display). */
  choiceText?: string;
  checks: VerificationCheck[];
}

const FLIP: Record<Rel, Rel> = { "=": "=", "<": ">", ">": "<", "<=": ">=", ">=": "<=" };
const holds = (v: Q, rel: Rel) =>
  rel === "=" ? isZero(v) : rel === "<" ? v.n < 0 : rel === ">" ? v.n > 0 : rel === "<=" ? v.n <= 0 : v.n >= 0;
const mono = (c: Q, v = "x") => polyLatex(scaleP(v === "x" ? varP("x") : varP("m"), c));
const set = (xs: Q[]) => `S = \\left\\{${xs.map(latex).join(";\\ ")}\\right\\}`;
const check = (label: string, passed: boolean): VerificationCheck => ({ label, passed });

/** Nghiệm của ax^2 + bx + c (đã biết a ≠ 0). */
function quadRoots(a: Q, b: Q, c: Q) {
  const delta = sub(mul(b, b), mul(q(4), mul(a, c)));
  const twoA = mul(q(2), a);
  if (delta.n < 0) return { delta, kind: "none" as const, roots: [] as Q[] };
  const s = sqrtExact(delta);
  if (s) {
    const r = [div(sub(neg(b), s), twoA), div(add(neg(b), s), twoA)].sort(cmp);
    return { delta, kind: "rational" as const, roots: eq(r[0], r[1]) ? [r[0]] : r };
  }
  // Δ = n/d → √Δ = √(n·d)/d = k√r/d
  const { k, r } = simplifySqrt(delta.n * delta.d);
  return { delta, kind: "irrational" as const, roots: [] as Q[], u: div(neg(b), twoA), v: abs(div(q(k, delta.d), twoA)), r };
}

const count = (lo: number, hi: number) => Math.max(0, hi - lo + 1);

export function solve(s: Structure): Solved {
  const P = s.P;
  switch (s.kind) {
    case "linear_equation": {
      const a = coef(P, 1);
      const b = coef(P, 0);
      const x0 = div(neg(b), a);
      return {
        key: `x=${plain(x0)}`,
        display: `$x = ${latex(x0)}$`,
        steps: [`$${mono(a)} = ${latex(neg(b))}$`, `$x = ${latex(x0)}$`],
        short: x0,
        shortLabel: "x =",
        checks: [check(`Thế $x = ${latex(x0)}$ vào phương trình: hai vế bằng nhau`, isZero(evalX(P, x0)))],
      };
    }

    case "quadratic_equation": {
      const [a, b, c] = coeffsX(P);
      const R = quadRoots(a, b, c);
      const deltaStep = `$\\Delta = b^2 - 4ac = ${latex(R.delta)}$`;
      const sum = div(neg(b), a);
      const prod = div(c, a);
      if (R.kind === "none") {
        if (s.ask !== "solve") throw new SolveError("Phương trình vô nghiệm, không hỏi được đáp số");
        return {
          key: "none",
          display: "Phương trình vô nghiệm",
          steps: [deltaStep, "$\\Delta < 0$ nên phương trình vô nghiệm"],
          checks: [check("$\\Delta < 0$: phương trình vô nghiệm", R.delta.n < 0)],
        };
      }
      if (R.kind === "irrational") {
        const vTex = eq(R.v!, ONE) ? "" : latex(R.v!);
        const uTex = isZero(R.u!) ? "" : `${latex(R.u!)} `;
        const display = `$x = ${uTex}\\pm ${vTex}\\sqrt{${R.r}}$`;
        // Vi-ét: (u + v√r) + (u − v√r) = 2u, (u + v√r)(u − v√r) = u² − v²r
        const vieta = eq(mul(q(2), R.u!), sum) && eq(sub(mul(R.u!, R.u!), mul(mul(R.v!, R.v!), q(R.r!))), prod);
        if (s.ask === "max_root") throw new SolveError("Nghiệm vô tỉ, không hỏi được nghiệm lớn nhất dạng số");
        return {
          key: s.ask === "sum_roots" ? `sum=${plain(sum)}` : `irr:${plain(R.u!)}:${plain(R.v!)}:${R.r}`,
          display: s.ask === "sum_roots" ? `$x_1 + x_2 = ${latex(sum)}$` : display,
          steps: [deltaStep, `$x = \\dfrac{-b \\pm \\sqrt{\\Delta}}{2a}$ nên ${display}`],
          short: s.ask === "sum_roots" ? sum : undefined,
          shortLabel: s.ask === "sum_roots" ? "x_1 + x_2 =" : undefined,
          checks: [check("Kiểm tra Vi-ét: tổng và tích hai nghiệm khớp $-\\dfrac{b}{a}$ và $\\dfrac{c}{a}$", vieta)],
        };
      }
      const roots = R.roots;
      const subst = roots.every((r) => isZero(evalX(P, r)));
      const base = {
        steps: [deltaStep, roots.length === 1 ? `Phương trình có nghiệm kép $x = ${latex(roots[0])}$` : `$x_1 = ${latex(roots[0])}$, $x_2 = ${latex(roots[1])}$`],
        checks: [check(`Thế ${roots.length === 1 ? "nghiệm" : "từng nghiệm"} vào phương trình: đều bằng 0`, subst)],
      };
      if (s.ask === "max_root") {
        const m = roots[roots.length - 1];
        return { ...base, key: `max=${plain(m)}`, display: `$x = ${latex(m)}$`, short: m, shortLabel: "x =" };
      }
      if (s.ask === "sum_roots") {
        return { ...base, key: `sum=${plain(sum)}`, display: `$x_1 + x_2 = ${latex(sum)}$`, short: sum, shortLabel: "x_1 + x_2 =" };
      }
      return {
        ...base,
        key: `roots:${roots.map(plain).join(",")}`,
        display: roots.length === 1 ? `$x = ${latex(roots[0])}$ (nghiệm kép)` : `$${set(roots)}$`,
        short: roots.length === 1 ? roots[0] : undefined,
        shortLabel: roots.length === 1 ? "x =" : undefined,
      };
    }

    case "quadratic_param": {
      // P = ax² + bx + (c0 + c1·m) → Δ(m) = K − L·m
      const a = coef(P, 2);
      const b = coef(P, 1);
      const c0 = coef(P, 0);
      const c1 = coef(P, 0, 1);
      const K = sub(mul(b, b), mul(q(4), mul(a, c0)));
      const L = mul(q(4), mul(a, c1));
      const B = div(K, L);
      const deltaM = addP(constP(K), scaleP(varP("m"), neg(L)));
      const need: Rel = { distinct: ">", double: "=", none: "<", some: ">=" }[s.cond ?? "distinct"] as Rel;
      // K − L·m (need) 0 ⇔ L·m (FLIP need) K ⇔ m (… đổi chiều nếu L < 0) B
      const relM: Rel = need === "=" ? "=" : L.n > 0 ? FLIP[need] : need;
      const display = `$m ${REL_LATEX[relM]} ${latex(B)}$`;
      // Thử một giá trị m thỏa mãn và một giá trị không thỏa mãn
      const inside = relM === "=" ? B : relM.startsWith("<") ? sub(B, ONE) : add(B, ONE);
      const outside = relM === "=" ? add(B, ONE) : relM.startsWith("<") ? add(B, ONE) : sub(B, ONE);
      const dAt = (m: Q) => sub(K, mul(L, m));
      const ok = holds(dAt(inside), need) && !holds(dAt(outside), need);
      let short: Q | undefined;
      if (s.ask === "max_int_m") {
        if (relM === "<") short = q(ceil(B) - 1);
        else if (relM === "<=") short = q(floor(B));
        else throw new SolveError("Tập giá trị của m không bị chặn trên");
      } else if (s.ask === "min_int_m") {
        if (relM === ">") short = q(floor(B) + 1);
        else if (relM === ">=") short = q(ceil(B));
        else throw new SolveError("Tập giá trị của m không bị chặn dưới");
      } else if (relM === "=") short = B;
      return {
        key: s.ask === "solve" ? `m${relM}${plain(B)}` : `${s.ask}=${plain(short!)}`,
        display: s.ask === "solve" ? display : `$m = ${latex(short!)}$`,
        steps: [
          `$\\Delta = ${polyLatex(deltaM)}$`,
          `Cần $\\Delta ${REL_LATEX[need]} 0 \\Leftrightarrow ${display.slice(1, -1)}$`,
          ...(s.ask !== "solve" ? [`Giá trị nguyên ${s.ask === "max_int_m" ? "lớn nhất" : "nhỏ nhất"} là $m = ${latex(short!)}$`] : []),
        ],
        short,
        shortLabel: "m =",
        checks: [check(`Thử $m = ${latex(inside)}$ (thỏa) và $m = ${latex(outside)}$ (không thỏa): đúng điều kiện của $\\Delta$`, ok)],
      };
    }

    case "linear_inequality": {
      const a = coef(P, 1);
      const b = coef(P, 0);
      const x0 = div(neg(b), a);
      const rel = a.n < 0 ? FLIP[s.rel!] : s.rel!;
      const display = `$x ${REL_LATEX[rel]} ${latex(x0)}$`;
      const inside = rel.startsWith("<") ? sub(x0, ONE) : add(x0, ONE);
      const outside = rel.startsWith("<") ? add(x0, ONE) : sub(x0, ONE);
      const ok = holds(evalX(P, inside), s.rel!) && !holds(evalX(P, outside), s.rel!);
      let short: Q | undefined;
      if (s.ask === "min_int") {
        if (rel === ">") short = q(floor(x0) + 1);
        else if (rel === ">=") short = q(ceil(x0));
        else throw new SolveError("Tập nghiệm không bị chặn dưới");
      } else if (s.ask === "max_int") {
        if (rel === "<") short = q(ceil(x0) - 1);
        else if (rel === "<=") short = q(floor(x0));
        else throw new SolveError("Tập nghiệm không bị chặn trên");
      }
      return {
        key: short ? `${s.ask}=${plain(short)}` : `x${rel}${plain(x0)}`,
        display: short ? `$x = ${latex(short)}$` : display,
        steps: [
          `$${mono(a)} ${REL_LATEX[s.rel!]} ${latex(neg(b))}$`,
          a.n < 0 ? `Chia hai vế cho $${latex(a)} < 0$ và đổi chiều: ${display}` : `Chia hai vế cho $${latex(a)}$: ${display}`,
          ...(short ? [`Số nguyên ${s.ask === "min_int" ? "nhỏ nhất" : "lớn nhất"} thỏa mãn là $${latex(short)}$`] : []),
        ],
        short,
        shortLabel: short ? "x =" : undefined,
        checks: [check(`Thử $x = ${latex(inside)}$ (thỏa) và $x = ${latex(outside)}$ (không thỏa)`, ok)],
      };
    }

    case "quadratic_inequality": {
      let [a, b, c] = coeffsX(P);
      let rel = s.rel!;
      const flipped = a.n < 0;
      if (flipped) {
        [a, b, c] = [neg(a), neg(b), neg(c)];
        rel = FLIP[rel];
      }
      const R = quadRoots(a, b, c);
      if (R.kind === "irrational") throw new SolveError("Chưa hỗ trợ bất phương trình bậc hai có nghiệm vô tỉ");
      const strict = rel === "<" || rel === ">";
      const above = rel.startsWith(">");
      const [r1, r2] = [R.roots[0], R.roots[R.roots.length - 1]];
      let display: string;
      let ints: number | undefined;
      if (R.kind === "none") {
        display = above ? "$S = \\mathbb{R}$" : "$S = \\varnothing$";
        ints = above ? undefined : 0;
      } else if (R.roots.length === 1) {
        if (above) display = strict ? `$S = \\mathbb{R} \\setminus \\left\\{${latex(r1)}\\right\\}$` : "$S = \\mathbb{R}$";
        else display = strict ? "$S = \\varnothing$" : `$S = \\left\\{${latex(r1)}\\right\\}$`;
        ints = above ? undefined : strict ? 0 : isInt(r1) ? 1 : 0;
      } else if (above) {
        display = `$S = (-\\infty;\\ ${latex(r1)}${strict ? ")" : "]"} \\cup ${strict ? "(" : "["}${latex(r2)};\\ +\\infty)$`;
      } else {
        display = `$S = ${strict ? "(" : "["}${latex(r1)};\\ ${latex(r2)}${strict ? ")" : "]"}$`;
        ints = strict ? count(floor(r1) + 1, ceil(r2) - 1) : count(ceil(r1), floor(r2));
      }
      // Thử điểm ở từng khoảng: trái r1, giữa, phải r2
      const probes = R.roots.length ? [sub(r1, ONE), ...(R.roots.length === 2 ? [div(add(r1, r2), q(2))] : []), add(r2, ONE)] : [ZERO];
      const inSet = (x: Q) => {
        if (R.kind === "none") return above;
        if (R.roots.length === 1) return eq(x, r1) ? !strict : above;
        const between = cmp(x, r1) > 0 && cmp(x, r2) < 0;
        return above ? !between : between;
      };
      const ok = probes.every((x) => holds(evalX(P, x), s.rel!) === inSet(x));
      if (s.ask === "count_int" && ints === undefined) throw new SolveError("Tập nghiệm có vô số số nguyên");
      return {
        key: s.ask === "count_int" ? `count=${ints}` : `qi:${display}`,
        display: s.ask === "count_int" ? `Có $${ints}$ nghiệm nguyên` : display,
        steps: [
          flipped ? `Nhân hai vế với $-1$ và đổi chiều: $${polyLatex(fromCoeffs([a, b, c]))} ${REL_LATEX[rel]} 0$` : "",
          R.roots.length
            ? `Tam thức có nghiệm ${R.roots.map((r) => `$${latex(r)}$`).join(" và ")}, hệ số $a > 0$`
            : `$\\Delta = ${latex(R.delta)} < 0$, tam thức luôn dương`,
          `Tập nghiệm: ${display}`,
        ].filter(Boolean),
        short: ints !== undefined && s.ask === "count_int" ? q(ints) : undefined,
        shortLabel: s.ask === "count_int" ? "\\text{Số nghiệm nguyên} =" : undefined,
        checks: [check("Thử một điểm trong mỗi khoảng chia bởi các nghiệm: đúng dấu", ok)],
      };
    }

    case "factorization": {
      const cubic = degX(P) === 3;
      if (cubic && !isZero(coef(P, 0))) throw new SolveError("Đa thức bậc ba không có nhân tử chung x");
      const Q2 = cubic ? fromCoeffs(coeffsX(P).slice(0, 3)) : P; // P = x·Q2
      const [a, b, c] = coeffsX(Q2);
      const R = quadRoots(a, b, c);
      if (R.kind !== "rational") throw new SolveError("Tam thức không phân tích được thành nhân tử hữu tỉ");
      const roots = R.roots.length === 1 ? [R.roots[0], R.roots[0]] : R.roots;
      // (d·x − n) với nghiệm n/d; hệ số còn lại k = a / (d1·d2)
      const factors = roots.map((r) => fromCoeffs([q(r.d), q(-r.n)]));
      const k = div(a, q(roots[0].d * roots[1].d));
      const fTex = (f: Poly) => (degX(f) === 1 && coef(f, 0).n === 0 && eq(coef(f, 1), ONE) ? "x" : `(${polyLatex(f)})`);
      const body = R.roots.length === 1 ? `${fTex(factors[0])}^2` : factors.map(fTex).join("");
      const kTex = eq(k, ONE) ? "" : eq(k, q(-1)) ? "-" : latex(k);
      const form = `${kTex}${cubic ? "x" : ""}${body}`;
      const expanded = scaleP(mulP(mulP(factors[0], factors[1]), cubic ? varP("x") : constP(ONE)), k);
      const same = polyLatex(expanded) === polyLatex(P);
      let short: Q | undefined;
      if (s.ask === "b_factor") {
        if (!eq(a, ONE) || cubic || R.roots.length !== 2 || !roots.every(isInt)) throw new SolveError("Không đưa được về dạng (x − a)(x − b) nguyên");
        short = roots[1];
      }
      return {
        key: short ? `b=${plain(short)}` : `factor:${form}`,
        display: short ? `$b = ${latex(short)}$` : `$${polyLatex(P)} = ${form}$`,
        choiceText: short ? undefined : `$${form}$`,
        steps: [
          ...(cubic ? [`Đặt nhân tử chung: $${polyLatex(P)} = x(${polyLatex(Q2)})$`] : []),
          `Tam thức $${polyLatex(Q2)}$ có nghiệm ${R.roots.map((r) => `$${latex(r)}$`).join(" và ")}`,
          `$${polyLatex(P)} = ${form}$`,
          ...(short ? [`Vậy $a = ${latex(roots[0])}$, $b = ${latex(short)}$`] : []),
        ],
        short,
        shortLabel: short ? "b =" : undefined,
        checks: [check("Nhân lại các nhân tử được đúng đa thức ban đầu", same)],
      };
    }

    case "function_value": {
      const v = evalX(P, s.t!);
      return {
        key: `y=${plain(v)}`,
        display: `$y = ${latex(v)}$`,
        steps: [`Thay $x = ${latex(s.t!)}$ vào $y = ${polyLatex(P)}$`, `$y = ${latex(v)}$`],
        short: v,
        shortLabel: "y =",
        checks: [check("Tính lại bằng cách thế trực tiếp: cùng kết quả", eq(v, evalX(P, s.t!)))],
      };
    }

    case "vertex":
    case "min_value": {
      const [a, b] = coeffsX(P);
      const h = div(neg(b), mul(q(2), a));
      const k = evalX(P, h);
      const deriv = add(mul(mul(q(2), a), h), b); // y'(h) = 2ah + b
      const checks = [check(`Đạo hàm $y' = 2ax + b$ bằng 0 tại $x = ${latex(h)}$`, isZero(deriv))];
      if (s.kind === "vertex") {
        return {
          key: s.ask === "vertex_x" ? `vx=${plain(h)}` : `v:${plain(h)},${plain(k)}`,
          display: s.ask === "vertex_x" ? `$x_0 = ${latex(h)}$` : `$I\\left(${latex(h)};\\ ${latex(k)}\\right)$`,
          steps: [`$x_0 = -\\dfrac{b}{2a} = ${latex(h)}$`, `$y_0 = y(${latex(h)}) = ${latex(k)}$`],
          short: s.ask === "vertex_x" ? h : undefined,
          shortLabel: s.ask === "vertex_x" ? "x_0 =" : undefined,
          checks,
        };
      }
      const wantMin = s.extreme !== "max";
      if ((sign(a) > 0) !== wantMin) throw new SolveError(wantMin ? "Hàm số không có giá trị nhỏ nhất (a < 0)" : "Hàm số không có giá trị lớn nhất (a > 0)");
      const name = wantMin ? "\\min" : "\\max";
      return {
        key: `${name}=${plain(k)}`,
        display: `$y_{${name}} = ${latex(k)}$ khi $x = ${latex(h)}$`,
        steps: [`$a = ${latex(a)} ${wantMin ? ">" : "<"} 0$, đỉnh tại $x = -\\dfrac{b}{2a} = ${latex(h)}$`, `$y_{${name}} = y(${latex(h)}) = ${latex(k)}$`],
        short: k,
        shortLabel: `y_{${name}} =`,
        checks: [...checks, check(`Hệ số $a ${wantMin ? "> 0" : "< 0"}$ nên đỉnh là điểm ${wantMin ? "thấp" : "cao"} nhất`, true)],
      };
    }
  }
}

/** Biến đổi nhỏ trên cấu trúc để tạo phương án nhiễu "giống lỗi học sinh hay mắc". */
export function nearMisses(s: Structure): Structure[] {
  const out: Structure[] = [];
  // Phương trình/tam thức có nghiệm hữu tỉ: nhiễu bằng cách đổi dấu hoặc lệch một nghiệm (lỗi hay gặp),
  // để phương án sai vẫn "trông hợp lý" thay vì ra nghiệm vô tỉ dễ loại.
  // Bậc ba có nhân tử chung x: nhiễu trên tam thức rồi nhân lại với x.
  const cubic = s.kind === "factorization" && degX(s.P) === 3 && isZero(coef(s.P, 0));
  if ((s.kind === "quadratic_equation" || s.kind === "factorization") && (degX(s.P) === 2 || cubic)) {
    const [a, b, c] = coeffsX(s.P);
    const R = quadRoots(a, b, c);
    if (R.kind === "rational") {
      const [p, t] = [R.roots[0], R.roots[R.roots.length - 1]];
      const lift = (P: Poly) => (cubic ? mulP(P, varP("x")) : P);
      const fromRootsQ = (u: Q, v: Q) => lift(fromCoeffs([a, neg(mul(a, add(u, v))), mul(a, mul(u, v))]));
      const pairs: [Q, Q][] = [[neg(p), t], [p, neg(t)], [neg(p), neg(t)], [add(p, ONE), sub(t, ONE)], [sub(p, ONE), add(t, ONE)], [add(p, ONE), t]];
      for (const [u, v] of pairs) {
        const P = fromRootsQ(u, v);
        if (polyLatex(P) !== polyLatex(s.P)) out.push({ ...s, P });
      }
    }
  }
  const flipCoef = (ex: number) => {
    const c = coef(s.P, ex);
    return isZero(c) ? null : addP(s.P, scaleP(ex === 0 ? constP(ONE) : ex === 1 ? varP("x") : mulP(varP("x"), varP("x")), mul(q(-2), c)));
  };
  const shift = (d: number) => addP(s.P, constP(q(d)));
  for (const P of [flipCoef(1), flipCoef(0), shift(1), shift(-1), shift(2), shift(-2), shift(3)]) if (P) out.push({ ...s, P });
  if (s.rel && s.rel !== "=") {
    out.unshift({ ...s, rel: FLIP[s.rel] });
    const toggle: Record<Rel, Rel> = { "=": "=", "<": "<=", "<=": "<", ">": ">=", ">=": ">" };
    out.unshift({ ...s, rel: toggle[s.rel] });
  }
  if (s.kind === "quadratic_param") {
    for (const cond of ["distinct", "none", "some", "double"] as const) if (cond !== s.cond) out.unshift({ ...s, cond });
  }
  if (s.kind === "function_value" && s.t) out.unshift({ ...s, t: neg(s.t) }, { ...s, t: add(s.t, ONE) });
  return out;
}
