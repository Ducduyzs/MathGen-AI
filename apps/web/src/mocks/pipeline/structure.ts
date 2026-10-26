// Biểu diễn có cấu trúc của một bài toán + nhận dạng từ văn bản + dựng lại đề từ cấu trúc.
// Đây là "ý tưởng cốt lõi" của đề tài: x² + 2x + c = 0 không chỉ là chuỗi ký tự mà là
// { dạng: phương trình bậc hai, a = 1, b = 2, c }.
import { normalizeMath, ParseError, parseExpr, parseRelation, type Rel } from "./parse";
import { coef, coeffsX, constOf, degM, degX, isConst, type Poly, polyLatex } from "./poly";
import { latex, type Q } from "./rational";

export type Kind =
  | "linear_equation"
  | "quadratic_equation"
  | "quadratic_param"
  | "linear_inequality"
  | "quadratic_inequality"
  | "factorization"
  | "function_value"
  | "vertex"
  | "min_value";

/** Điều kiện nghiệm cho phương trình chứa tham số m. */
export type Cond = "distinct" | "double" | "none" | "some";

/** Câu hỏi đặt ra trên cùng một cấu trúc (giải trọn vẹn hay hỏi một đáp số). */
export type Ask =
  | "solve"
  | "max_root"
  | "sum_roots"
  | "max_int_m"
  | "min_int_m"
  | "min_int"
  | "max_int"
  | "count_int"
  | "b_factor"
  | "vertex_x";

export interface Structure {
  kind: Kind;
  /** Với phương trình/bất phương trình: P(x) rel 0. Với hàm số: y = P(x). */
  P: Poly;
  rel?: Rel;
  cond?: Cond;
  /** Điểm cần tính giá trị (function_value). */
  t?: Q;
  extreme?: "min" | "max";
  ask: Ask;
}

/** Cách trình bày vế trái/vế phải (để đề sinh ra trông tự nhiên, không phải lúc nào cũng "= 0"). */
export interface Presentation {
  lhs: string;
  rhs: string;
}

export const KIND_LABEL: Record<Kind, string> = {
  linear_equation: "Phương trình bậc nhất",
  quadratic_equation: "Phương trình bậc hai",
  quadratic_param: "Phương trình bậc hai chứa tham số",
  linear_inequality: "Bất phương trình bậc nhất",
  quadratic_inequality: "Bất phương trình bậc hai",
  factorization: "Phân tích đa thức thành nhân tử",
  function_value: "Giá trị của hàm số",
  vertex: "Đỉnh của parabol",
  min_value: "Giá trị lớn nhất/nhỏ nhất của hàm bậc hai",
};

export const KIND_SKILL: Record<Kind, { skill: string; grade: number }> = {
  linear_equation: { skill: "linear_equation", grade: 8 },
  quadratic_equation: { skill: "quadratic_equation", grade: 9 },
  quadratic_param: { skill: "quadratic_equation", grade: 9 },
  linear_inequality: { skill: "inequality", grade: 8 },
  quadratic_inequality: { skill: "inequality", grade: 10 },
  factorization: { skill: "factorization", grade: 8 },
  function_value: { skill: "function", grade: 9 },
  vertex: { skill: "function", grade: 10 },
  min_value: { skill: "function", grade: 10 },
};

export const REL_LATEX: Record<Rel, string> = { "=": "=", "<": "<", ">": ">", "<=": "\\le", ">=": "\\ge" };
export const COND_TEXT: Record<Cond, string> = {
  distinct: "có hai nghiệm phân biệt",
  double: "có nghiệm kép",
  none: "vô nghiệm",
  some: "có nghiệm",
};

// ---------------------------------------------------------------- Tách công thức khỏi lời văn

const PLAIN_RUN = /[-+−–—0-9xmyf()[\]\s.,/*^²³=<>≤≥·]+/g;
const isMathRun = (r: string) => /[xm]/.test(r) && /[-+=<>≤≥^²*/()·0-9−–]/.test(r) && r.length >= 3;
const trimRun = (r: string) => r.trim().replace(/^[.,]+|[.,]+$/g, "").trim();

/** Công thức trong đề: lấy trong $...$ nếu có, nếu không thì tìm đoạn ký tự toán trong chữ thường (PDF/Word). */
export function mathSegments(text: string): string[] {
  if (text.includes("$")) return [...text.matchAll(/\$\$?([^$]+?)\$\$?/g)].map((m) => m[1].trim());
  return (text.match(PLAIN_RUN) ?? []).map(trimRun).filter(isMathRun);
}

/** Bọc các đoạn công thức của chữ thường vào $...$ để hiển thị bằng KaTeX. */
export function toDisplay(text: string) {
  if (text.includes("$")) return text;
  return text.replace(PLAIN_RUN, (run) => {
    const core = trimRun(run);
    if (!isMathRun(core)) return run;
    const start = run.indexOf(core);
    const tex = normalizeMath(core).replace(/\*/g, " \\cdot ").replace(/\s+/g, " ").trim();
    return `${run.slice(0, start)}$${tex}$${run.slice(start + core.length)}`;
  });
}

// ---------------------------------------------------------------- Nhận dạng

export type Recognition =
  | { ok: true; structure: Structure; confidence: number }
  | { ok: false; reason: string };

const fail = (reason: string): Recognition => ({ ok: false, reason });
const RELATION = /[=<>≤≥]|\\le|\\ge/;

export function recognize(statement: string): Recognition {
  const low = statement.toLowerCase();
  // Câu Đúng/Sai nhiều ý: các ý con ("Tổng hai nghiệm bằng…") dễ bị đọc nhầm thành câu hỏi chính.
  if (/đúng hay sai|đúng\s*\/\s*sai/.test(low)) return fail("Câu Đúng/Sai nhiều ý chưa được hỗ trợ nhận dạng tự động.");
  const segs = mathSegments(statement);
  if (!segs.length) return fail("Không tìm thấy biểu thức đại số một biến (có thể là bài hình học, chứng minh hoặc toán lời văn).");

  const fromLatex = statement.includes("$");
  const ok = (structure: Structure, keyword: boolean): Recognition => ({
    ok: true,
    structure,
    confidence: Math.min(0.98, Math.max(0.5, 0.68 + (keyword ? 0.25 : 0) + (fromLatex ? 0.05 : -0.05))),
  });

  try {
    // Dạng "Biết P = (x - a)(x - b) với a < b. Tìm b."
    const abSeg = segs.find((s) => /\(\s*x\s*-\s*a\s*\)\s*\(\s*x\s*-\s*b\s*\)/.test(s));
    if (abSeg) {
      const P = parseExpr(abSeg.split("=")[0]);
      if (degX(P) !== 2 || degM(P) > 0) return fail("Đa thức không phải bậc hai.");
      return ok({ kind: "factorization", P, ask: "b_factor" }, true);
    }

    // Hàm số y = P(x) hoặc f(x) = P(x)
    const fnSeg = segs.find((s) => /^(y|f\s*\(\s*x\s*\))\s*=/.test(s));
    if (fnSeg) {
      const P = parseExpr(fnSeg.slice(fnSeg.indexOf("=") + 1));
      if (degM(P) > 0) return fail("Hàm số chứa tham số chưa được hỗ trợ.");
      const keyword = /hàm số|parabol|đồ thị/.test(low);
      if (/đỉnh/.test(low)) {
        if (degX(P) !== 2) return fail("Chỉ parabol (hàm bậc hai) mới có đỉnh.");
        return ok({ kind: "vertex", P, ask: /hoành độ/.test(low) ? "vertex_x" : "solve" }, keyword);
      }
      const ext = /giá trị (nhỏ nhất|lớn nhất)/.exec(low);
      if (ext) {
        if (degX(P) !== 2) return fail("Chỉ hỗ trợ giá trị lớn nhất/nhỏ nhất của hàm bậc hai.");
        return ok({ kind: "min_value", P, extreme: ext[1] === "lớn nhất" ? "max" : "min", ask: "solve" }, keyword);
      }
      const atSeg = segs.find((s) => /^x\s*=/.test(s) && !/[xm]/.test(s.slice(s.indexOf("=") + 1)));
      const fAt = /f\s*\(\s*([^()x]+?)\s*\)/.exec(fromLatex ? segs.join(" ") : statement);
      const tSrc = atSeg ? atSeg.slice(atSeg.indexOf("=") + 1) : fAt?.[1];
      if (tSrc) {
        const tp = parseExpr(tSrc);
        if (!isConst(tp)) return fail("Không đọc được giá trị của x.");
        return ok({ kind: "function_value", P, t: constOf(tp), ask: "solve" }, keyword);
      }
      return fail("Nhận ra hàm số nhưng chưa rõ đề yêu cầu tính gì.");
    }

    // Phân tích đa thức thành nhân tử
    if (/phân tích/.test(low)) {
      const src = segs.find((s) => !RELATION.test(s) && /x/.test(s));
      if (!src) return fail("Không tìm thấy đa thức cần phân tích.");
      const P = parseExpr(src);
      if (degM(P) > 0 || degX(P) < 2 || degX(P) > 3) return fail("Chỉ hỗ trợ đa thức bậc hai, hoặc bậc ba có nhân tử chung x.");
      return ok({ kind: "factorization", P, ask: "solve" }, true);
    }

    // Phương trình / bất phương trình: bỏ qua các đoạn gán "x = 3", "m = 2"
    const relSeg = segs.find((s) => RELATION.test(s) && !/^[xm]\s*=\s*[^xm]*$/.test(s));
    if (!relSeg) return fail("Không tìm thấy phương trình hoặc bất phương trình.");
    const { P, rel } = parseRelation(relSeg);
    if (!rel) return fail("Không tìm thấy dấu so sánh.");
    const d = degX(P);

    if (rel === "=") {
      if (degM(P) > 0) {
        const linearInM = degM(P) === 1 && coef(P, 1, 1).n === 0 && coef(P, 2, 1).n === 0;
        if (d !== 2 || !linearInM) return fail("Chỉ hỗ trợ tham số m nằm ở hệ số tự do của phương trình bậc hai.");
        const cond: Cond | null = /phân biệt/.test(low)
          ? "distinct"
          : /nghiệm kép/.test(low)
            ? "double"
            : /vô nghiệm/.test(low)
              ? "none"
              : /có nghiệm/.test(low)
                ? "some"
                : null;
        if (!cond) return fail("Chưa rõ điều kiện về nghiệm của phương trình chứa m.");
        const ask: Ask = /nguyên lớn nhất/.test(low) ? "max_int_m" : /nguyên nhỏ nhất/.test(low) ? "min_int_m" : "solve";
        return ok({ kind: "quadratic_param", P, rel, cond, ask }, /tìm \$?m/.test(low));
      }
      const keyword = /phương trình|tìm \$?x|biết|nghiệm/.test(low);
      if (d === 1) return ok({ kind: "linear_equation", P, rel, ask: "solve" }, keyword);
      if (d === 2) {
        const ask: Ask = /nghiệm lớn nhất/.test(low) ? "max_root" : /tổng (các|hai) nghiệm/.test(low) ? "sum_roots" : "solve";
        return ok({ kind: "quadratic_equation", P, rel, ask }, keyword);
      }
      return fail(d === 0 ? "Đẳng thức không chứa ẩn." : "Chưa hỗ trợ phương trình bậc ba trở lên.");
    }

    if (degM(P) > 0) return fail("Bất phương trình chứa tham số chưa được hỗ trợ.");
    const keyword = /bất phương trình|thỏa mãn|nghiệm nguyên/.test(low);
    if (d === 1) {
      const ask: Ask = /số nguyên.*nhỏ nhất/.test(low) ? "min_int" : /số nguyên.*lớn nhất/.test(low) ? "max_int" : "solve";
      return ok({ kind: "linear_inequality", P, rel, ask }, keyword);
    }
    if (d === 2) {
      return ok({ kind: "quadratic_inequality", P, rel, ask: /bao nhiêu nghiệm nguyên/.test(low) ? "count_int" : "solve" }, keyword);
    }
    return fail("Chưa hỗ trợ bất phương trình bậc này.");
  } catch (e) {
    if (e instanceof ParseError) return fail(`Không đọc được biểu thức: ${e.message}.`);
    throw e;
  }
}

// ---------------------------------------------------------------- Dựng đề từ cấu trúc

export function render(s: Structure, pres?: Presentation): string {
  const P = polyLatex(s.P);
  const rel = REL_LATEX[s.rel ?? "="];
  const side = pres ? `${pres.lhs} ${rel} ${pres.rhs}` : `${P} ${rel} 0`;
  switch (s.kind) {
    case "linear_equation":
      return `Giải phương trình $${side}$.`;
    case "quadratic_equation":
      if (s.ask === "max_root") return `Tìm nghiệm lớn nhất của phương trình $${side}$.`;
      if (s.ask === "sum_roots") return `Tính tổng các nghiệm của phương trình $${side}$.`;
      return `Giải phương trình $${side}$.`;
    case "quadratic_param": {
      const cond = COND_TEXT[s.cond ?? "distinct"];
      if (s.ask === "max_int_m") return `Tìm giá trị nguyên lớn nhất của $m$ để phương trình $${side}$ ${cond}.`;
      if (s.ask === "min_int_m") return `Tìm giá trị nguyên nhỏ nhất của $m$ để phương trình $${side}$ ${cond}.`;
      return `Tìm $m$ để phương trình $${side}$ ${cond}.`;
    }
    case "linear_inequality":
      if (s.ask === "min_int") return `Tìm số nguyên $x$ nhỏ nhất thỏa mãn $${side}$.`;
      if (s.ask === "max_int") return `Tìm số nguyên $x$ lớn nhất thỏa mãn $${side}$.`;
      return `Giải bất phương trình $${side}$.`;
    case "quadratic_inequality":
      if (s.ask === "count_int") return `Bất phương trình $${side}$ có bao nhiêu nghiệm nguyên?`;
      return `Giải bất phương trình $${side}$.`;
    case "factorization":
      if (s.ask === "b_factor") return `Biết $${P} = (x - a)(x - b)$ với $a < b$. Tìm $b$.`;
      return `Phân tích đa thức $${P}$ thành nhân tử.`;
    case "function_value":
      return `Cho hàm số $y = ${P}$. Tính giá trị của $y$ khi $x = ${latex(s.t!)}$.`;
    case "vertex":
      return s.ask === "vertex_x" ? `Tìm hoành độ đỉnh của parabol $y = ${P}$.` : `Tìm tọa độ đỉnh của parabol $y = ${P}$.`;
    case "min_value":
      return `Tìm giá trị ${s.extreme === "max" ? "lớn nhất" : "nhỏ nhất"} của hàm số $y = ${P}$.`;
  }
}

/** Dạng tổng quát + tham số, ví dụ ax^2 + bx + c = 0 với a = 1, b = -5, c = 6. */
export function generalForm(s: Structure): { template: string; params: { name: string; value: string }[] } {
  const rel = REL_LATEX[s.rel ?? "="];
  const names = ["a", "b", "c", "d"];
  const cs = degM(s.P) > 0 ? null : coeffsX(s.P);
  const params = (cs ?? []).map((c, i) => ({ name: names[i], value: latex(c) }));
  switch (s.kind) {
    case "linear_equation":
      return { template: "ax + b = 0", params };
    case "quadratic_equation":
      return { template: "ax^2 + bx + c = 0", params };
    case "quadratic_param":
      return {
        template: `ax^2 + bx + c(m) = 0`,
        params: [
          { name: "a", value: latex(coef(s.P, 2)) },
          { name: "b", value: latex(coef(s.P, 1)) },
          { name: "c(m)", value: polyLatex(new Map([...s.P].filter(([k]) => k.startsWith("0,")))) },
        ],
      };
    case "linear_inequality":
      return { template: `ax + b ${rel} 0`, params };
    case "quadratic_inequality":
      return { template: `ax^2 + bx + c ${rel} 0`, params };
    case "factorization":
      return { template: degX(s.P) === 3 ? "ax^3 + bx^2 + cx + d" : "ax^2 + bx + c", params };
    case "function_value":
      return {
        template: degX(s.P) === 1 ? "y = ax + b" : "y = ax^2 + bx + c",
        params: [...params, { name: "x_0", value: latex(s.t!) }],
      };
    case "vertex":
    case "min_value":
      return { template: "y = ax^2 + bx + c", params };
  }
}
