// Bộ phân tích biểu thức (recursive descent) đọc được cả LaTeX ($x^2 - 5x + 6 = 0$, \dfrac{x}{4})
// lẫn chữ thường trích từ PDF/Word (x² – 5x + 6 = 0, 3(x – 2), 2·x). Kết quả là đa thức chính xác.
// Backend Python: thay bằng sympy.parsing với danh sách ký hiệu được phép (không dùng eval trên chuỗi người dùng).
import { addP, constOf, constP, isConst, mulP, negP, type Poly, powP, scaleP, subP, varP } from "./poly";
import { div, fromDecimal, isInt, isZero, ONE } from "./rational";

export class ParseError extends Error {}

export type Rel = "=" | "<" | ">" | "<=" | ">=";

type Tok =
  | { t: "num"; v: string }
  | { t: "var"; v: "x" | "m" }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "^" | "(" | ")" | "{" | "}" | "frac" }
  | { t: "rel"; v: Rel };

/** Chuẩn hóa ký hiệu: dấu trừ Unicode, chỉ số trên, \cdot, \left( … */
export function normalizeMath(s: string) {
  return s
    .replace(/\\left|\\right|\\displaystyle|\\limits/g, "")
    .replace(/\\[dt]?frac/g, " \\frac ")
    .replace(/\\cdot|\\times|×|·|∙/g, "*")
    .replace(/[−–—‒]/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\\leq?(?![a-z])|≤|<=|⩽/g, " \\le ")
    .replace(/\\geq?(?![a-z])|≥|>=|⩾/g, " \\ge ")
    .replace(/\\[,;!: ]|\\quad|\\qquad/g, " ")
    .replace(/\[/g, "(")
    .replace(/]/g, ")");
}

function tokenize(src: string): Tok[] {
  const s = normalizeMath(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = /^\d+(?:[.,]\d+)?/.exec(s.slice(i));
    if (num) {
      out.push({ t: "num", v: num[0] });
      i += num[0].length;
      continue;
    }
    if (ch === "\\") {
      const cmd = /^\\[a-zA-Z]+/.exec(s.slice(i))?.[0] ?? "\\";
      i += cmd.length;
      if (cmd === "\\frac") out.push({ t: "frac" });
      else if (cmd === "\\le") out.push({ t: "rel", v: "<=" });
      else if (cmd === "\\ge") out.push({ t: "rel", v: ">=" });
      else throw new ParseError(`Ký hiệu chưa hỗ trợ: ${cmd}`);
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      if (ch !== "x" && ch !== "m") throw new ParseError(`Biến chưa hỗ trợ: ${ch}`);
      out.push({ t: "var", v: ch });
      i++;
      continue;
    }
    i++;
    if ("+-*/".includes(ch)) out.push({ t: "op", v: ch as "+" | "-" | "*" | "/" });
    else if (ch === ":") out.push({ t: "op", v: "/" });
    else if ("^(){}".includes(ch)) out.push({ t: ch as "^" | "(" | ")" | "{" | "}" });
    else if (ch === "=") out.push({ t: "rel", v: "=" });
    else if (ch === "<") out.push({ t: "rel", v: "<" });
    else if (ch === ">") out.push({ t: "rel", v: ">" });
    else throw new ParseError(`Ký tự lạ: ${ch}`);
  }
  return out;
}

class Parser {
  pos = 0;
  constructor(private toks: Tok[]) {}

  private peek() {
    return this.toks[this.pos];
  }

  private expect(t: Tok["t"]) {
    const tok = this.toks[this.pos++];
    if (tok?.t !== t) throw new ParseError("Biểu thức không hợp lệ");
  }

  done() {
    return this.pos >= this.toks.length;
  }

  expr(): Poly {
    let left = this.term();
    for (let t = this.peek(); t?.t === "op" && (t.v === "+" || t.v === "-"); t = this.peek()) {
      this.pos++;
      const right = this.term();
      left = t.v === "+" ? addP(left, right) : subP(left, right);
    }
    return left;
  }

  private term(): Poly {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t?.t === "op" && (t.v === "*" || t.v === "/")) {
        this.pos++;
        const right = this.unary();
        left = t.v === "*" ? mulP(left, right) : divConst(left, right);
      } else if (t && (t.t === "var" || t.t === "(" || t.t === "frac" || t.t === "{")) {
        left = mulP(left, this.power()); // nhân ngầm: 2x, 3(x - 2), (x - 1)(x + 2)
      } else return left;
    }
  }

  private unary(): Poly {
    const t = this.peek();
    if (t?.t === "op" && (t.v === "-" || t.v === "+")) {
      this.pos++;
      const v = this.unary();
      return t.v === "-" ? negP(v) : v;
    }
    return this.power();
  }

  private power(): Poly {
    const base = this.atom();
    if (this.peek()?.t !== "^") return base;
    this.pos++;
    const exp = this.atom();
    const c = constOf(exp);
    if (!isConst(exp) || !isInt(c) || c.n < 0 || c.n > 6) throw new ParseError("Số mũ chưa hỗ trợ");
    return powP(base, c.n);
  }

  private atom(): Poly {
    const t = this.toks[this.pos++];
    switch (t?.t) {
      case "num":
        return constP(fromDecimal(t.v));
      case "var":
        return varP(t.v);
      case "(": {
        const v = this.expr();
        this.expect(")");
        return v;
      }
      case "{": {
        const v = this.expr();
        this.expect("}");
        return v;
      }
      case "frac": {
        this.expect("{");
        const a = this.expr();
        this.expect("}");
        this.expect("{");
        const b = this.expr();
        this.expect("}");
        return divConst(a, b);
      }
      default:
        throw new ParseError("Biểu thức không hợp lệ");
    }
  }
}

function divConst(a: Poly, b: Poly) {
  if (!isConst(b) || isZero(constOf(b))) throw new ParseError("Chỉ hỗ trợ chia cho hằng số khác 0");
  return scaleP(a, div(ONE, constOf(b)));
}

function parseTokens(toks: Tok[]): Poly {
  if (!toks.length) throw new ParseError("Biểu thức rỗng");
  const p = new Parser(toks);
  const v = p.expr();
  if (!p.done()) throw new ParseError("Biểu thức không hợp lệ");
  return v;
}

const trimPunct = (s: string) => s.trim().replace(/^[.,;:]+|[.,;:]+$/g, "").trim();

export const parseExpr = (src: string) => parseTokens(tokenize(trimPunct(src)));

/** "L rel R" → đa thức P = L − R và quan hệ; không có quan hệ thì trả về biểu thức. */
export function parseRelation(src: string): { P: Poly; rel: Rel | null } {
  const toks = tokenize(trimPunct(src));
  const at = toks.flatMap((t, i) => (t.t === "rel" ? [i] : []));
  if (at.length === 0) return { P: parseTokens(toks), rel: null };
  if (at.length > 1) throw new ParseError("Chưa hỗ trợ chuỗi nhiều dấu so sánh");
  const rel = (toks[at[0]] as { t: "rel"; v: Rel }).v;
  return { P: subP(parseTokens(toks.slice(0, at[0])), parseTokens(toks.slice(at[0] + 1))), rel };
}
