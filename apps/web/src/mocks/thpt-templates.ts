// Dạng bài lớp 10–12 cho đề thi tốt nghiệp THPT (cấu trúc từ 2025): Phần I nhiều lựa chọn,
// Phần II Đúng/Sai, Phần III trả lời ngắn. Mỗi lần gọi make() sinh số liệu mới kèm đáp án.
import {
  C, coin, frac, lin, makeChoices, nonZero, number, p3, pick, poly, r, rand, shuffle, tf, type ExamTemplate,
} from "./gen-utils";

const cubic = (b2: number, b1: number, c: number) => poly([[1, "x^3"], [b2, "x^2"], [b1, "x"], [c, ""]]);
const mono = (c: number, e: number) => {
  const coef = c === 1 ? "" : c === -1 ? "-" : `${c}`;
  return e === 0 ? `${c}` : e === 1 ? `${coef}x` : `${coef}x^{${e}}`;
};
const iv = (a: string | number, b: string | number) => r`(${a};\ ${b})`;
/** Bộ ba nguyên (a, b, c) có a² + b² + c² là số chính phương. */
const TRIPLES: [number, number, number, number][] = [
  [1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11], [6, 6, 7, 11], [2, 5, 14, 15], [2, 10, 11, 15],
];
function vector3() {
  const [a, b, c, len] = pick(TRIPLES);
  const v = shuffle([a, b, c]).map((x) => (coin() ? x : -x));
  return { v, len };
}
const point3 = () => [rand(-5, 5), rand(-5, 5), rand(-5, 5)];
/** (x - a)^2 hoặc x^2 khi a = 0. */
const sq = (name: string, a: number) => (a === 0 ? `${name}^2` : `(${poly([[1, name], [-a, ""]])})^2`);

export const THPT_TEMPLATES: ExamTemplate[] = [
  // =============== PHẦN I: nhiều phương án lựa chọn
  {
    code: "thpt_monotonic", name: "Tính đơn điệu của hàm số", skill: "calculus", grade: 12, difficulty: 0.3, mode: "choice", type: "choice", part: "I",
    make: () => {
      const p = rand(1, 3), c = rand(-5, 5);
      const m = makeChoices(iv(0, 2 * p), [r`(-\infty;\ 0)`, iv(2 * p, r`+\infty`), iv(-2 * p, 0)]);
      return {
        statement: r`Hàm số $y = ${cubic(-3 * p, 0, c)}$ nghịch biến trên khoảng nào dưới đây?`, ...m,
        solution: [r`$y' = 3x^2 - ${6 * p}x = 3x(x - ${2 * p})$`, r`$y' < 0 \Leftrightarrow 0 < x < ${2 * p}$`],
      };
    },
  },
  {
    code: "thpt_extremum", name: "Cực trị của hàm số", skill: "calculus", grade: 12, difficulty: 0.35, mode: "choice", type: "choice", part: "I",
    make: () => {
      const k = rand(1, 4), c = rand(-5, 5);
      const m = makeChoices(`x = ${k}`, [`x = ${-k}`, "x = 0", `x = ${k * k}`, `x = ${2 * k}`]);
      return {
        statement: r`Điểm cực tiểu của hàm số $y = ${cubic(0, -3 * k * k, c)}$ là`, ...m,
        solution: [r`$y' = 3x^2 - ${3 * k * k} = 0 \Leftrightarrow x = \pm ${k}$`, r`$y'$ đổi dấu từ âm sang dương khi qua $x = ${k}$`],
      };
    },
  },
  {
    code: "thpt_asymptote", name: "Tiệm cận của đồ thị", skill: "calculus", grade: 12, difficulty: 0.25, mode: "choice", type: "choice", part: "I",
    make: () => {
      const a = nonZero(-5, 5), c = nonZero(-5, 5);
      let b = rand(-6, 6);
      while (a * c + b === 0) b = rand(-6, 6);
      const m = makeChoices(`y = ${a}`, [`x = ${c}`, `y = ${-a}`, `y = ${c}`, `x = ${a}`, `y = ${a + 1}`, `x = ${-c}`]);
      return {
        statement: r`Tiệm cận ngang của đồ thị hàm số $y = \dfrac{${lin(a, b)}}{${lin(1, -c)}}$ là đường thẳng`, ...m,
        solution: [r`$\lim\limits_{x \to \pm\infty} y = ${a}$ nên tiệm cận ngang là $y = ${a}$`],
      };
    },
  },
  {
    code: "thpt_antiderivative", name: "Nguyên hàm", skill: "calculus", grade: 12, difficulty: 0.25, mode: "choice", type: "choice", part: "I",
    make: () => {
      const n = rand(1, 3), k = rand(1, 4), f = mono((n + 1) * k, n);
      const m = makeChoices(`${mono(k, n + 1)} + C`, [`${mono(n * (n + 1) * k, n - 1)} + C`, `${mono((n + 1) * k, n + 1)} + C`, `${mono(k, n)} + C`]);
      return {
        statement: r`Họ nguyên hàm của hàm số $f(x) = ${f}$ là`, ...m,
        solution: [r`$\displaystyle\int ${f}\,dx = ${(n + 1) * k} \cdot \dfrac{x^{${n + 1}}}{${n + 1}} + C = ${mono(k, n + 1)} + C$`],
      };
    },
  },
  {
    code: "thpt_integral_value", name: "Tích phân", skill: "calculus", grade: 12, difficulty: 0.4, mode: "choice", type: "choice", part: "I",
    make: () => {
      const k = rand(1, 4), a = rand(-4, 5), v = k * k + a * k;
      const m = makeChoices(`${v}`, [`${2 * k + a}`, `${k * k}`, `${k * k + 2 * a * k}`, `${v + 1}`, `${v - 1}`, `${v + 2}`]);
      return {
        statement: r`Giá trị của $\displaystyle\int_0^{${k}} (${lin(2, a)})\,dx$ bằng`, ...m,
        solution: [r`$\displaystyle\int_0^{${k}} (${lin(2, a)})\,dx = \Big(${poly([[1, "x^2"], [a, "x"]])}\Big)\Big|_0^{${k}} = ${v}$`],
      };
    },
  },
  {
    code: "thpt_log_equation", name: "Phương trình logarit", skill: "exp_log", grade: 11, difficulty: 0.35, mode: "choice", type: "choice", part: "I",
    make: () => {
      const a = rand(-5, 5), k = rand(1, 4), x = a + 2 ** k;
      const m = makeChoices(`x = ${x}`, [`x = ${a + 2 * k}`, `x = ${2 ** k - a}`, `x = ${x + 1}`, `x = ${x - 1}`, `x = ${x + 2}`]);
      return {
        statement: r`Nghiệm của phương trình $\log_2 (${lin(1, -a)}) = ${k}$ là`, ...m,
        solution: [r`Điều kiện: $x > ${a}$`, r`$${lin(1, -a)} = 2^{${k}} = ${2 ** k} \Leftrightarrow x = ${x}$ (thỏa mãn)`],
      };
    },
  },
  {
    code: "thpt_exp_equation", name: "Phương trình mũ", skill: "exp_log", grade: 11, difficulty: 0.3, mode: "choice", type: "choice", part: "I",
    make: () => {
      const b = pick([2, 3, 5]), e = rand(1, 3);
      let a = rand(-4, 4);
      if ((e + a) % 2 !== 0) a += 1;
      const x = (e + a) / 2;
      const m = makeChoices(`x = ${x}`, [`x = ${e + a}`, `x = ${frac(e - a, 2)}`, `x = ${x + 1}`, `x = ${x - 1}`, `x = ${x + 2}`]);
      return {
        statement: r`Nghiệm của phương trình $${b}^{${lin(2, -a)}} = ${b ** e}$ là`, ...m,
        solution: [r`$${b}^{${lin(2, -a)}} = ${b}^{${e}} \Leftrightarrow ${lin(2, -a)} = ${e} \Leftrightarrow x = ${x}$`],
      };
    },
  },
  {
    code: "thpt_pyramid_volume", name: "Thể tích khối chóp", skill: "geometry_space", grade: 12, difficulty: 0.35, mode: "choice", type: "choice", part: "I",
    make: () => {
      const s = rand(2, 6), h = 3 * rand(1, 4), V = (s * s * h) / 3;
      const m = makeChoices(`${V}`, [`${s * s * h}`, frac(s * s * h, 2), `${s * h}`, frac(s * s * h, 6)]);
      return {
        statement: `Cho khối chóp có đáy là hình vuông cạnh $${s}$ và chiều cao bằng $${h}$. Thể tích của khối chóp đã cho bằng`, ...m,
        solution: [r`$V = \dfrac{1}{3}Bh$ với $B = ${s}^2 = ${s * s}$`, r`$V = \dfrac{1}{3} \cdot ${s * s} \cdot ${h} = ${V}$`],
      };
    },
  },
  {
    code: "thpt_oxyz_midpoint", name: "Tọa độ trung điểm trong không gian", skill: "coordinates_3d", grade: 12, difficulty: 0.25, mode: "choice", type: "choice", part: "I",
    make: () => {
      const A = point3();
      const B = A.map((x) => x + 2 * rand(-3, 3));
      const I = A.map((x, i) => (x + B[i]) / 2);
      const m = makeChoices(p3(...I), [
        p3(...A.map((x, i) => x + B[i])), p3(...A.map((x, i) => B[i] - x)), p3(...I.map((x) => -x)),
        p3(...A.map((x, i) => (B[i] - x) / 2)), p3(...I.map((x) => x + 1)), p3(...I.map((x) => x - 1)),
      ]);
      return {
        statement: r`Trong không gian $Oxyz$, cho hai điểm $A${p3(...A)}$ và $B${p3(...B)}$. Tọa độ trung điểm $I$ của đoạn thẳng $AB$ là`, ...m,
        solution: [r`$I\left(\dfrac{x_A + x_B}{2};\ \dfrac{y_A + y_B}{2};\ \dfrac{z_A + z_B}{2}\right) = ${p3(...I)}$`],
      };
    },
  },
  {
    code: "thpt_sphere", name: "Tâm và bán kính mặt cầu", skill: "coordinates_3d", grade: 12, difficulty: 0.3, mode: "choice", type: "choice", part: "I",
    make: () => {
      let P = point3();
      while (P.every((x) => x === 0)) P = point3();
      const R = rand(2, 6), neg = P.map((x) => -x);
      const opt = (Q: number[], rr: number) => r`I${p3(...Q)},\ R = ${rr}`;
      const m = makeChoices(opt(P, R), [opt(neg, R), opt(P, R * R), opt(neg, R * R)]);
      return {
        statement: r`Trong không gian $Oxyz$, mặt cầu $(S): ${sq("x", P[0])} + ${sq("y", P[1])} + ${sq("z", P[2])} = ${R * R}$ có tâm $I$ và bán kính $R$ là`, ...m,
        solution: [r`Mặt cầu $(x - a)^2 + (y - b)^2 + (z - c)^2 = R^2$ có tâm $I(a;\ b;\ c)$, bán kính $R$`, r`Tâm $I${p3(...P)}$, $R = \sqrt{${R * R}} = ${R}$`],
      };
    },
  },
  {
    code: "thpt_probability_classic", name: "Xác suất cổ điển", skill: "probability_statistics", grade: 10, difficulty: 0.3, mode: "choice", type: "choice", part: "I",
    make: () => {
      const red = rand(2, 8), blue = rand(2, 8), n = red + blue;
      const m = makeChoices(frac(red, n), [frac(blue, n), frac(red, blue), frac(1, n), frac(red, n + 1)]);
      return {
        statement: `Một hộp có $${red}$ viên bi đỏ và $${blue}$ viên bi xanh. Lấy ngẫu nhiên 1 viên bi. Xác suất để lấy được viên bi đỏ là`, ...m,
        solution: [r`$n(\Omega) = ${n}$, $n(A) = ${red}$`, r`$P(A) = \dfrac{${red}}{${n}} = ${frac(red, n)}$`],
      };
    },
  },
  {
    code: "thpt_grouped_range", name: "Khoảng biến thiên của mẫu số liệu ghép nhóm", skill: "probability_statistics", grade: 11, difficulty: 0.25, mode: "choice", type: "choice", part: "I",
    make: () => {
      const a0 = 5 * rand(1, 10), w = pick([2, 5, 10]), k = rand(4, 6);
      const groups = Array.from({ length: k }, (_, i) => r`$[${a0 + i * w};\ ${a0 + (i + 1) * w})$: ${rand(2, 12)}`).join("; ");
      const R = k * w;
      const m = makeChoices(`${R}`, [`${R - w}`, `${a0 + R}`, `${w}`, `${R + w}`]);
      return {
        statement: `Cho mẫu số liệu ghép nhóm (nhóm: tần số) — ${groups}. Khoảng biến thiên của mẫu số liệu ghép nhóm trên là`, ...m,
        solution: [r`$R = a_{${k + 1}} - a_1 = ${a0 + R} - ${a0} = ${R}$`],
      };
    },
  },
  {
    code: "thpt_arithmetic_seq", name: "Cấp số cộng", skill: "sequences", grade: 11, difficulty: 0.25, mode: "choice", type: "choice", part: "I",
    make: () => {
      const u1 = rand(-5, 8), d = nonZero(-4, 5), n = rand(5, 15), un = u1 + (n - 1) * d;
      const m = makeChoices(`${un}`, [`${u1 + n * d}`, `${u1 + (n - 2) * d}`, `${(n - 1) * d}`, `${un + 1}`, `${un - 1}`, `${un + 2}`]);
      return {
        statement: r`Cho cấp số cộng $(u_n)$ có $u_1 = ${u1}$ và công sai $d = ${d}$. Giá trị của $u_{${n}}$ bằng`, ...m,
        solution: [r`$u_n = u_1 + (n - 1)d$`, r`$u_{${n}} = ${u1} + ${n - 1} \cdot (${d}) = ${un}$`],
      };
    },
  },
  {
    code: "thpt_geometric_seq", name: "Cấp số nhân", skill: "sequences", grade: 11, difficulty: 0.3, mode: "choice", type: "choice", part: "I",
    make: () => {
      const u1 = rand(1, 5), q = pick([2, 3, -2]), n = rand(3, 6), un = u1 * q ** (n - 1);
      const m = makeChoices(`${un}`, [`${u1 * q ** n}`, `${u1 * q ** (n - 2)}`, `${u1 + (n - 1) * q}`, `${-un}`]);
      return {
        statement: r`Cho cấp số nhân $(u_n)$ có $u_1 = ${u1}$ và công bội $q = ${q}$. Giá trị của $u_{${n}}$ bằng`, ...m,
        solution: [r`$u_n = u_1 \cdot q^{n - 1}$`, r`$u_{${n}} = ${u1} \cdot (${q})^{${n - 1}} = ${un}$`],
      };
    },
  },

  // =============== PHẦN II: Đúng/Sai
  {
    code: "thpt_tf_function", name: "Đúng/Sai: khảo sát hàm số bậc ba", skill: "calculus", grade: 12, difficulty: 0.55, mode: "choice", type: "true_false", part: "II",
    make: () => {
      const k = pick([1, 2]), c = rand(-4, 4), K = 3 * k * k, top = 2 * k ** 3 + c;
      const t = [coin(), coin(), coin(), coin()];
      const q = tf(
        [
          t[0] ? r`$y' = 3x^2 - ${K}$.` : r`$y' = 3x^2 - ${K}x$.`,
          `Hàm số ${t[1] ? "nghịch biến" : "đồng biến"} trên khoảng $${iv(-k, k)}$.`,
          `Giá trị cực đại của hàm số bằng $${t[2] ? top : -2 * k ** 3 + c}$.`,
          r`Giá trị lớn nhất của hàm số trên đoạn $[0;\ ${2 * k}]$ bằng $${t[3] ? top : c}$.`,
        ],
        t,
      );
      return {
        statement: r`Cho hàm số $y = ${cubic(0, -K, c)}$. Mỗi ý sau đúng hay sai?`, ...q,
        solution: [
          r`$y' = 3x^2 - ${K} = 0 \Leftrightarrow x = \pm ${k}$; $y' < 0$ trên $${iv(-k, k)}$`,
          r`Cực đại tại $x = ${-k}$: $y_{\text{CĐ}} = ${top}$; cực tiểu tại $x = ${k}$: $y_{\text{CT}} =${-2 * k ** 3 + c}$`,
          r`Trên $[0;\ ${2 * k}]$: $y(0) = ${c}$, $y(${k}) = ${-2 * k ** 3 + c}$, $y(${2 * k}) = ${top}$ nên giá trị lớn nhất là $${top}$`,
        ],
      };
    },
  },
  {
    code: "thpt_tf_integral", name: "Đúng/Sai: nguyên hàm, tích phân, diện tích", skill: "calculus", grade: 12, difficulty: 0.55, mode: "choice", type: "true_false", part: "II",
    make: () => {
      const a = rand(1, 5), k = rand(1, 4), area = k * k + a * k, d = k * k + 2 * k + a * k;
      const t = [coin(), coin(), coin(), coin()];
      const q = tf(
        [
          `$F(x) = ${t[0] ? poly([[1, "x^2"], [a, "x"]]) : poly([[2, "x^2"], [a, "x"]])}$ là một nguyên hàm của $f(x)$.`,
          r`$\displaystyle\int_0^1 f(x)\,dx = ${t[1] ? 1 + a : 2 + a}$.`,
          `Diện tích hình phẳng giới hạn bởi đồ thị $y = f(x)$, trục hoành và các đường thẳng $x = 0$, $x = ${k}$ bằng $${t[2] ? area : area + k}$.`,
          r`$\displaystyle\int_1^{${k + 1}} f(x)\,dx = ${t[3] ? d : d + 1}$.`,
        ],
        t,
      );
      return {
        statement: `Cho hàm số $f(x) = ${lin(2, a)}$. Mỗi ý sau đúng hay sai?`, ...q,
        solution: [
          r`$F(x) = ${poly([[1, "x^2"], [a, "x"]])}$ là một nguyên hàm của $f(x)$`,
          r`$\displaystyle\int_0^1 f(x)\,dx = F(1) - F(0) = ${1 + a}$`,
          r`$f(x) > 0$ trên $[0;\ ${k}]$ nên $S = \displaystyle\int_0^{${k}} f(x)\,dx = ${area}$`,
          r`$\displaystyle\int_1^{${k + 1}} f(x)\,dx = F(${k + 1}) - F(1) = ${d}$`,
        ],
      };
    },
  },
  {
    code: "thpt_tf_oxyz", name: "Đúng/Sai: vectơ, khoảng cách trong Oxyz", skill: "coordinates_3d", grade: 12, difficulty: 0.6, mode: "choice", type: "true_false", part: "II",
    make: () => {
      const A = point3(), { v, len } = vector3(), B = A.map((x, i) => x + v[i]);
      const t = [coin(), coin(), coin(), coin()];
      const onPlane = -(2 * A[0] + A[1] - 2 * A[2]);
      let d = onPlane;
      if (!t[2]) while (d === onPlane) d = nonZero(-9, 9);
      const dist = frac(Math.abs(d), 3);
      const q = tf(
        [
          r`$\overrightarrow{AB} = ${p3(...(t[0] ? v : v.map((x) => -x)))}$.`,
          `$AB = ${t[1] ? len : len * len}$.`,
          "Điểm $A$ thuộc mặt phẳng $(P)$.",
          r`Khoảng cách từ gốc tọa độ $O$ đến $(P)$ bằng $${t[3] ? dist : d === 0 ? 1 : Math.abs(d)}$.`,
        ],
        t,
      );
      return {
        statement: r`Trong không gian $Oxyz$, cho $A${p3(...A)}$, $B${p3(...B)}$ và mặt phẳng $(P): ${poly([[2, "x"], [1, "y"], [-2, "z"], [d, ""]])} = 0$. Mỗi ý sau đúng hay sai?`, ...q,
        solution: [
          r`$\overrightarrow{AB} = ${p3(...v)}$, $AB = \sqrt{${v.map((x) => (x < 0 ? `(${x})^2` : `${x}^2`)).join(" + ")}} = ${len}$`,
          r`Thay $A$ vào $(P)$: $${2 * A[0] + A[1] - 2 * A[2] + d} ${t[2] ? "=" : "\\ne"} 0$`,
          r`$d(O, (P)) = \dfrac{|${d}|}{\sqrt{2^2 + 1^2 + 2^2}} = ${dist}$`,
        ],
      };
    },
  },
  {
    code: "thpt_tf_probability", name: "Đúng/Sai: xác suất lấy hai viên bi", skill: "probability_statistics", grade: 10, difficulty: 0.6, mode: "choice", type: "true_false", part: "II",
    make: () => {
      const red = rand(3, 6), blue = rand(2, 5), n = red + blue, total = C(n, 2);
      const t = [coin(), coin(), coin(), coin()];
      const atLeastBlue = frac(total - C(red, 2), total);
      let wrongC = frac(C(blue, 2), total);
      if (wrongC === atLeastBlue) wrongC = frac(C(blue, 2) + 1, total);
      const q = tf(
        [
          `Số cách lấy 2 viên bi từ hộp là $${t[0] ? total : n * (n - 1)}$.`,
          `Xác suất để lấy được 2 viên bi đỏ là $${t[1] ? frac(C(red, 2), total) : frac(red * red, n * n)}$.`,
          `Xác suất để có ít nhất 1 viên bi xanh là $${t[2] ? atLeastBlue : wrongC}$.`,
          `Xác suất để lấy được 1 viên bi đỏ và 1 viên bi xanh là $${t[3] ? frac(red * blue, total) : frac(red * blue, n * n)}$.`,
        ],
        t,
      );
      return {
        statement: `Một hộp có $${red}$ viên bi đỏ và $${blue}$ viên bi xanh. Lấy ngẫu nhiên đồng thời 2 viên bi. Mỗi ý sau đúng hay sai?`, ...q,
        solution: [
          r`$n(\Omega) = C_{${n}}^2 = ${total}$`,
          r`$P(\text{2 đỏ}) = \dfrac{C_{${red}}^2}{${total}} = ${frac(C(red, 2), total)}$, nên $P(\text{ít nhất 1 xanh}) = 1 - ${frac(C(red, 2), total)} = ${atLeastBlue}$`,
          r`$P(\text{1 đỏ, 1 xanh}) = \dfrac{${red} \cdot ${blue}}{${total}} = ${frac(red * blue, total)}$`,
        ],
      };
    },
  },

  // =============== PHẦN III: trả lời ngắn
  {
    code: "thpt_prism_volume", name: "Thể tích khối lăng trụ", skill: "geometry_space", grade: 12, difficulty: 0.45, mode: "written", type: "number", part: "III",
    make: () => {
      const a = 2 * rand(1, 4), b = rand(2, 7), h = rand(2, 9), V = (a * b * h) / 2;
      return {
        statement: `Cho khối lăng trụ đứng có đáy là tam giác vuông với hai cạnh góc vuông bằng $${a}$ và $${b}$, chiều cao bằng $${h}$. Tính thể tích khối lăng trụ.`,
        answer_prefix: "V =", answer: number(V), answer_display: `$V = ${V}$`,
        solution: [r`$B = \dfrac{1}{2} \cdot ${a} \cdot ${b} = ${(a * b) / 2}$`, r`$V = Bh = ${(a * b) / 2} \cdot ${h} = ${V}$`],
      };
    },
  },
  {
    code: "thpt_optimization", name: "Bài toán tối ưu (ứng dụng đạo hàm)", skill: "calculus", grade: 12, difficulty: 0.6, mode: "written", type: "number", part: "III",
    make: () => {
      const P = 4 * rand(5, 30), half = P / 2, side = P / 4;
      return {
        statement: `Bác An dùng $${P}$ mét lưới để rào một mảnh vườn hình chữ nhật. Diện tích lớn nhất của mảnh vườn là bao nhiêu mét vuông?`,
        answer_prefix: r`S_{\max} =`, answer: number(side * side), answer_display: r`$S_{\max} = ${side * side}$ m²`,
        solution: [
          r`Gọi một cạnh là $x$ $(0 < x < ${half})$, cạnh còn lại là $${half} - x$`,
          r`$S(x) = x(${half} - x)$, $S'(x) = ${half} - 2x = 0 \Leftrightarrow x = ${side}$`,
          r`$S_{\max} = S(${side}) = ${side * side}$`,
        ],
      };
    },
  },
  {
    code: "thpt_conditional_prob", name: "Xác suất có điều kiện", skill: "probability_statistics", grade: 12, difficulty: 0.65, mode: "written", type: "number", part: "III",
    make: () => {
      const boys = rand(15, 22), girls = rand(15, 22), bm = rand(3, 9), gm = rand(3, 9);
      const value = (gm / (bm + gm)).toFixed(2);
      return {
        statement: `Một lớp có $${boys}$ nam và $${girls}$ nữ, trong đó có $${bm}$ nam và $${gm}$ nữ đạt học sinh giỏi. Chọn ngẫu nhiên một học sinh của lớp, biết học sinh đó đạt học sinh giỏi. Tính xác suất để học sinh đó là nữ (làm tròn kết quả đến hàng phần trăm).`,
        answer_prefix: "P =", answer: number(value), tolerance: 0.005 + 1e-9,
        answer_display: r`$P = ${frac(gm, bm + gm)} \approx ${value.replace(".", "{,}")}$`,
        solution: [r`Gọi $A$: "học sinh là nữ", $B$: "học sinh giỏi"`, r`$P(A \mid B) = \dfrac{n(A \cap B)}{n(B)} = \dfrac{${gm}}{${bm + gm}} \approx ${value.replace(".", "{,}")}$`],
      };
    },
  },
  {
    code: "thpt_oxyz_distance", name: "Độ dài đoạn thẳng trong không gian", skill: "coordinates_3d", grade: 12, difficulty: 0.4, mode: "written", type: "number", part: "III",
    make: () => {
      const A = point3(), { v, len } = vector3(), B = A.map((x, i) => x + v[i]);
      return {
        statement: r`Trong không gian $Oxyz$, cho hai điểm $A${p3(...A)}$ và $B${p3(...B)}$. Tính độ dài đoạn thẳng $AB$.`,
        answer_prefix: "AB =", answer: number(len), answer_display: `$AB = ${len}$`,
        solution: [r`$\overrightarrow{AB} = ${p3(...v)}$`, r`$AB = \sqrt{${v.map((x) => x * x).join(" + ")}} = ${len}$`],
      };
    },
  },
  {
    code: "thpt_integral_cubic", name: "Tính tích phân", skill: "calculus", grade: 12, difficulty: 0.5, mode: "written", type: "number", part: "III",
    make: () => {
      const k = rand(1, 3), a = rand(-3, 4), v = k ** 3 + a * k * k;
      return {
        statement: r`Tính $I = \displaystyle\int_0^{${k}} (${poly([[3, "x^2"], [2 * a, "x"]])})\,dx$.`,
        answer_prefix: "I =", answer: number(v), answer_display: `$I = ${v}$`,
        solution: [r`$I = \Big(${poly([[1, "x^3"], [a, "x^2"]])}\Big)\Big|_0^{${k}} = ${v}$`],
      };
    },
  },
  {
    code: "thpt_arith_sum", name: "Tổng cấp số cộng", skill: "sequences", grade: 11, difficulty: 0.5, mode: "written", type: "number", part: "III",
    make: () => {
      const u1 = rand(-5, 10), d = nonZero(-3, 5), n = rand(8, 20), S = (n * (2 * u1 + (n - 1) * d)) / 2;
      return {
        statement: `Cho cấp số cộng có $u_1 = ${u1}$ và công sai $d = ${d}$. Tính tổng $${n}$ số hạng đầu tiên.`,
        answer_prefix: r`S_{${n}} =`, answer: number(S), answer_display: r`$S_{${n}} = ${S}$`,
        solution: [r`$S_n = \dfrac{n[2u_1 + (n - 1)d]}{2}$`, r`$S_{${n}} = \dfrac{${n} \cdot [${2 * u1} + ${n - 1} \cdot (${d})]}{2} = ${S}$`],
      };
    },
  },
  {
    code: "thpt_log_short", name: "Phương trình logarit (trả lời ngắn)", skill: "exp_log", grade: 11, difficulty: 0.45, mode: "written", type: "number", part: "III",
    make: () => {
      const a = rand(-6, 6), k = rand(1, 3), x = 3 ** k - a;
      return {
        statement: r`Tìm nghiệm của phương trình $\log_3 (${lin(1, a)}) = ${k}$.`,
        answer_prefix: "x =", answer: number(x), answer_display: `$x = ${x}$`,
        solution: [r`Điều kiện: $x > ${-a}$`, r`$${lin(1, a)} = 3^{${k}} = ${3 ** k} \Leftrightarrow x = ${x}$`],
      };
    },
  },
];

/** Thứ tự chủ đề trong Phần I, giống cách đề chính thức xếp: giải tích → mũ-log → hình → xác suất → dãy số. */
const TOPIC_ORDER = ["calculus", "exp_log", "geometry_space", "coordinates_3d", "probability_statistics", "sequences"];

export const THPT_BLUEPRINT = {
  duration_minutes: 90,
  parts: [
    { part: "I", type: "choice", count: 12, points: 0.25 },
    { part: "II", type: "true_false", count: 4, points: 1 },
    { part: "III", type: "number", count: 6, points: 0.5 },
  ],
} as const;

/**
 * Đề tốt nghiệp THPT: 12 câu Phần I, 4 câu Phần II, 6 câu Phần III.
 * Mỗi phần lấy trước một dạng cho mỗi chủ đề (để đề luôn phủ đủ chủ đề), sau đó rút thêm cho đủ số câu.
 */
export function buildThptTemplates() {
  return THPT_BLUEPRINT.parts.flatMap(({ part, count }) => {
    const pool = shuffle(THPT_TEMPLATES.filter((t) => t.part === part));
    const firstPerTopic = TOPIC_ORDER.flatMap((skill) => pool.find((t) => t.skill === skill) ?? []);
    const rest = pool.filter((t) => !firstPerTopic.includes(t));
    return [...firstPerTopic, ...rest]
      .slice(0, count)
      .sort((a, b) => TOPIC_ORDER.indexOf(a.skill) - TOPIC_ORDER.indexOf(b.skill) || a.difficulty - b.difficulty);
  });
}
