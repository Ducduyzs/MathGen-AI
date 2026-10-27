// Dạng bài Toán tiểu học lớp 1–5 cho mock API (backend: apps/api/app/modules/exams/generator/primary.py).
// Số thập phân hiển thị kiểu Việt Nam (dấu phẩy, viết {,} trong LaTeX); đáp số lưu dạng có dấu chấm.
import { coin, frac, makeChoices, number, pick, r, rand, shuffle, type ExamTemplate } from "./gen-utils";

const plain = (x: number) => String(Number(x.toFixed(2)));
const dec = (x: number) => plain(x).replace(".", "{,}");
const cm = (v: number) => r`${v}\text{ cm}`;
const uniq = (xs: number[]) => xs.map(String);

export const PRIMARY_TEMPLATES: ExamTemplate[] = [
  // ---------------- lớp 1
  {
    code: "p1_add_20", name: "Cộng trong phạm vi 20", skill: "p_add_sub", grade: 1, difficulty: 0.1, mode: "written", type: "number",
    make: () => {
      const a = rand(1, 12), b = rand(1, 20 - a);
      return { statement: r`Tính: $${a} + ${b} = ?$`, answer: number(a + b), answer_display: `${a + b}`, solution: [r`$${a} + ${b} = ${a + b}$`] };
    },
  },
  {
    code: "p1_sub_20", name: "Trừ trong phạm vi 20", skill: "p_add_sub", grade: 1, difficulty: 0.12, mode: "written", type: "number",
    make: () => {
      const a = rand(5, 20), b = rand(1, a);
      return { statement: r`Tính: $${a} - ${b} = ?$`, answer: number(a - b), answer_display: `${a - b}`, solution: [r`$${a} - ${b} = ${a - b}$`] };
    },
  },
  {
    code: "p1_compare_100", name: "So sánh các số trong phạm vi 100", skill: "p_number", grade: 1, difficulty: 0.1, mode: "choice", type: "choice",
    make: () => {
      const xs = shuffle(Array.from({ length: 90 }, (_, i) => i + 10)).slice(0, 4);
      const big = coin();
      const best = big ? Math.max(...xs) : Math.min(...xs);
      const m = makeChoices(`${best}`, xs.filter((x) => x !== best).map(String));
      return {
        statement: `Số nào ${big ? "lớn" : "bé"} nhất trong các số: ${xs.map((x) => `$${x}$`).join(", ")}?`, ...m,
        solution: [`Xếp theo thứ tự tăng dần: $${[...xs].sort((a, b) => a - b).join("<")}$`, `Số ${big ? "lớn" : "bé"} nhất là $${best}$`],
      };
    },
  },
  // ---------------- lớp 2
  {
    code: "p2_add_sub_100", name: "Cộng, trừ có nhớ trong phạm vi 100", skill: "p_add_sub", grade: 2, difficulty: 0.2, mode: "written", type: "number",
    make: () => {
      if (coin()) {
        const a = rand(15, 69), b = rand(15, 30);
        return { statement: r`Đặt tính rồi tính: $${a} + ${b}$`, answer: number(a + b), answer_display: `${a + b}`, solution: [r`$${a} + ${b} = ${a + b}$`] };
      }
      const a = rand(40, 99), b = rand(12, a - 10);
      return { statement: r`Đặt tính rồi tính: $${a} - ${b}$`, answer: number(a - b), answer_display: `${a - b}`, solution: [r`$${a} - ${b} = ${a - b}$`] };
    },
  },
  {
    code: "p2_mul_table", name: "Bảng nhân 2 và 5", skill: "p_mul_div", grade: 2, difficulty: 0.2, mode: "choice", type: "choice",
    make: () => {
      const a = pick([2, 5]), b = rand(1, 10), p = a * b;
      const m = makeChoices(`${p}`, uniq([p + a, p - a, a + b, p + 1, p - 1, p + 2 * a]));
      return { statement: r`$${a} \times ${b} = ?$`, ...m, solution: [r`$${a} \times ${b} = ${p}$`] };
    },
  },
  {
    code: "p2_word_more", name: "Bài toán nhiều hơn, ít hơn", skill: "p_word", grade: 2, difficulty: 0.25, mode: "written", type: "number",
    make: () => {
      const a = rand(20, 60), d = rand(5, 19);
      const [name, thing] = pick([["Lan", "bông hoa"], ["Nam", "viên bi"], ["Mai", "quyển truyện"], ["Hùng", "con tem"]] as const);
      const more = coin();
      const v = more ? a + d : a - d;
      return {
        statement: `${name} có ${a} ${thing}, bạn của ${name} có ${more ? "nhiều" : "ít"} hơn ${name} ${d} ${thing}. Hỏi bạn của ${name} có bao nhiêu ${thing}?`,
        answer: number(v), answer_display: `${v} ${thing}`, solution: [`$${a} ${more ? "+" : "-"} ${d} = ${v}$ (${thing})`],
      };
    },
  },
  {
    code: "p2_length", name: "Đổi đơn vị độ dài", skill: "p_measure", grade: 2, difficulty: 0.25, mode: "choice", type: "choice",
    make: () => {
      const a = rand(2, 9);
      if (coin()) {
        const m = makeChoices(cm(a * 10), [cm(a), cm(a * 100), cm(a + 10)]);
        return { statement: r`$${a}\text{ dm} = \;?$`, ...m, solution: [r`$1\text{ dm} = 10\text{ cm}$`, r`$${a}\text{ dm} = ${a * 10}\text{ cm}$`] };
      }
      const m = makeChoices(cm(a * 100), [cm(a * 10), cm(a), cm(a * 1000)]);
      return { statement: r`$${a}\text{ m} = \;?$`, ...m, solution: [r`$1\text{ m} = 100\text{ cm}$`, r`$${a}\text{ m} = ${a * 100}\text{ cm}$`] };
    },
  },
  // ---------------- lớp 3
  {
    code: "p3_mul_div_table", name: "Bảng nhân, bảng chia 2–9", skill: "p_mul_div", grade: 3, difficulty: 0.3, mode: "written", type: "number",
    make: () => {
      const a = rand(2, 9), b = rand(2, 9);
      if (coin()) return { statement: r`Tính: $${a} \times ${b}$`, answer: number(a * b), answer_display: `${a * b}`, solution: [r`$${a} \times ${b} = ${a * b}$`] };
      return { statement: r`Tính: $${a * b} : ${a}$`, answer: number(b), answer_display: `${b}`, solution: [r`Vì $${a} \times ${b} = ${a * b}$ nên $${a * b} : ${a} = ${b}$`] };
    },
  },
  {
    code: "p3_find_x", name: "Tìm thành phần chưa biết", skill: "p_add_sub", grade: 3, difficulty: 0.35, mode: "written", type: "number",
    make: () => {
      const k = pick(["add", "sub", "mul"] as const);
      const done = (statement: string, x: number, step: string) =>
        ({ statement, answer: number(x), answer_display: `x = ${x}`, solution: [step, r`$x = ${x}$`], answer_prefix: "x =" });
      if (k === "add") {
        const x = rand(100, 600), a = rand(50, 300);
        return done(r`Tìm $x$, biết: $x + ${a} = ${x + a}$`, x, r`$x = ${x + a} - ${a}$`);
      }
      if (k === "sub") {
        const x = rand(200, 900), a = rand(50, 180);
        return done(r`Tìm $x$, biết: $x - ${a} = ${x - a}$`, x, r`$x = ${x - a} + ${a}$`);
      }
      const x = rand(2, 9), a = rand(3, 9);
      return done(r`Tìm $x$, biết: $x \times ${a} = ${x * a}$`, x, r`$x = ${x * a} : ${a}$`);
    },
  },
  {
    code: "p3_perimeter", name: "Chu vi hình chữ nhật, hình vuông", skill: "p_geometry", grade: 3, difficulty: 0.35, mode: "choice", type: "choice",
    make: () => {
      if (coin()) {
        const a = rand(6, 20), b = rand(2, 5), p = 2 * (a + b);
        const m = makeChoices(cm(p), [a + b, a * b, p + 2, p - 2, 2 * a + b].map(cm));
        return { statement: `Hình chữ nhật có chiều dài $${a}$ cm, chiều rộng $${b}$ cm. Chu vi hình chữ nhật là`, ...m, solution: [r`Chu vi $= (${a} + ${b}) \times 2 = ${p}$ (cm)`] };
      }
      const a = rand(3, 25);
      const m = makeChoices(cm(4 * a), [a * a, 2 * a, 4 * a + 4, 4 * a - 4, 3 * a].map(cm));
      return { statement: `Hình vuông có cạnh $${a}$ cm. Chu vi hình vuông là`, ...m, solution: [r`Chu vi $= ${a} \times 4 = ${4 * a}$ (cm)`] };
    },
  },
  {
    code: "p3_time", name: "Đổi giờ, phút", skill: "p_measure", grade: 3, difficulty: 0.3, mode: "written", type: "number",
    make: () => {
      const h = rand(1, 3), mi = pick([5, 10, 15, 20, 30, 45]), v = h * 60 + mi;
      return { statement: `$${h}$ giờ $${mi}$ phút bằng bao nhiêu phút?`, answer: number(v), answer_display: `${v} phút`, solution: [r`$1$ giờ $= 60$ phút`, r`$${h} \times 60 + ${mi} = ${v}$ (phút)`] };
    },
  },
  // ---------------- lớp 4
  {
    code: "p4_average", name: "Tìm số trung bình cộng", skill: "p_word", grade: 4, difficulty: 0.4, mode: "written", type: "number",
    make: () => {
      const n = pick([3, 4]), avg = rand(30, 80);
      const xs = Array.from({ length: n - 1 }, () => avg + rand(-12, 12));
      xs.push(avg * n - xs.reduce((s, x) => s + x, 0));
      return {
        statement: `Tìm số trung bình cộng của các số: ${xs.map((x) => `$${x}$`).join(", ")}.`, answer: number(avg), answer_display: `${avg}`,
        solution: [`$(${xs.join(" + ")}) : ${n} = ${avg * n} : ${n} = ${avg}$`],
      };
    },
  },
  {
    code: "p4_area_rect", name: "Diện tích hình chữ nhật", skill: "p_geometry", grade: 4, difficulty: 0.35, mode: "written", type: "number",
    make: () => {
      const a = rand(8, 30), b = rand(3, 12);
      return {
        statement: `Một mảnh vườn hình chữ nhật có chiều dài $${a}$ m, chiều rộng $${b}$ m. Tính diện tích mảnh vườn (m²).`,
        answer: number(a * b), answer_display: `${a * b} m²`, solution: [r`Diện tích $= ${a} \times ${b} = ${a * b}$ (m²)`],
      };
    },
  },
  {
    code: "p4_fraction_compare", name: "So sánh phân số", skill: "p_fraction", grade: 4, difficulty: 0.45, mode: "choice", type: "choice",
    make: () => {
      const d = rand(5, 12);
      const nums = shuffle(Array.from({ length: d - 1 }, (_, i) => i + 1)).slice(0, 4);
      const best = Math.max(...nums);
      const raw = (n: number) => r`\dfrac{${n}}{${d}}`; // giữ nguyên mẫu số để so sánh tử
      const m = makeChoices(raw(best), nums.filter((n) => n !== best).map(raw));
      return { statement: "Phân số nào lớn nhất?", ...m, solution: [`Các phân số cùng mẫu $${d}$: phân số nào có tử lớn hơn thì lớn hơn`, `Lớn nhất là $${raw(best)}$`] };
    },
  },
  {
    code: "p4_fraction_add", name: "Cộng phân số cùng mẫu", skill: "p_fraction", grade: 4, difficulty: 0.4, mode: "choice", type: "choice",
    make: () => {
      const d = rand(5, 15), a = rand(1, d - 2), b = rand(1, d - a - 1), s = frac(a + b, d);
      const m = makeChoices(s, [frac(a + b, 2 * d), frac(a * b, d), frac(a + b + 1, d), frac(a + b - 1, d), frac(a + b, d + 1), frac(a + b + 2, d)]);
      return { statement: r`Tính: $\dfrac{${a}}{${d}} + \dfrac{${b}}{${d}}$`, ...m, solution: [r`$\dfrac{${a}}{${d}} + \dfrac{${b}}{${d}} = \dfrac{${a} + ${b}}{${d}} = ${s}$`] };
    },
  },
  // ---------------- lớp 5
  {
    code: "p5_decimal_add", name: "Cộng, trừ số thập phân", skill: "p_decimal", grade: 5, difficulty: 0.45, mode: "written", type: "number",
    make: () => {
      let a = rand(105, 995) / 100, b = rand(15, 495) / 100;
      const add = coin();
      if (!add) [a, b] = [Math.max(a, b), Math.min(a, b)];
      const v = Number((add ? a + b : a - b).toFixed(2));
      return {
        statement: r`Tính: $${dec(a)} ${add ? "+" : "-"} ${dec(b)}$`, answer: number(plain(v)), answer_display: dec(v).replace("{,}", ","),
        solution: [r`$${dec(a)} ${add ? "+" : "-"} ${dec(b)} = ${dec(v)}$`],
      };
    },
  },
  {
    code: "p5_percent", name: "Tìm giá trị phần trăm của một số", skill: "p_decimal", grade: 5, difficulty: 0.55, mode: "choice", type: "choice",
    make: () => {
      const p = pick([10, 20, 25, 40, 50, 75]), base = pick([40, 60, 80, 120, 200, 240, 400]), v = (p * base) / 100;
      const m = makeChoices(`${v}`, uniq([p + base, base - v, v * 10, v + p, v * 2, v + 5]));
      return { statement: r`Tìm $${p}\%$ của $${base}$.`, ...m, solution: [r`$${base} \times ${p} : 100 = ${v}$`] };
    },
  },
  {
    code: "p5_speed", name: "Vận tốc, quãng đường, thời gian", skill: "p_word", grade: 5, difficulty: 0.55, mode: "written", type: "number",
    make: () => {
      const v = pick([30, 36, 40, 45, 48, 50, 60]), t = pick([2, 3, 4]), who = pick(["Một ô tô", "Một xe máy", "Một đoàn tàu"]);
      if (coin()) {
        return { statement: `${who} đi với vận tốc $${v}$ km/giờ trong $${t}$ giờ. Tính quãng đường đi được (km).`, answer: number(v * t), answer_display: `${v * t} km`, solution: [r`$s = v \times t = ${v} \times ${t} = ${v * t}$ (km)`] };
      }
      return { statement: `${who} đi quãng đường $${v * t}$ km hết $${t}$ giờ. Tính vận tốc (km/giờ).`, answer: number(v), answer_display: `${v} km/giờ`, solution: [r`$v = s : t = ${v * t} : ${t} = ${v}$ (km/giờ)`] };
    },
  },
  {
    code: "p5_triangle_area", name: "Diện tích hình tam giác", skill: "p_geometry", grade: 5, difficulty: 0.5, mode: "choice", type: "choice",
    make: () => {
      const a = rand(3, 20) * 2, h = rand(3, 15), s = (a * h) / 2;
      const cm2 = (x: number) => r`${x}\text{ cm}^2`;
      const m = makeChoices(cm2(s), [a * h, a + h, s + h, s + a, s - 1].map(cm2));
      return { statement: `Hình tam giác có đáy $${a}$ cm, chiều cao $${h}$ cm. Diện tích hình tam giác là`, ...m, solution: [r`$S = ${a} \times ${h} : 2 = ${s}$ (cm²)`] };
    },
  },
  {
    code: "p5_box_volume", name: "Thể tích hình hộp chữ nhật", skill: "p_geometry", grade: 5, difficulty: 0.5, mode: "written", type: "number",
    make: () => {
      const a = rand(3, 12), b = rand(2, 8), c = rand(2, 6), v = a * b * c;
      return { statement: `Hình hộp chữ nhật có chiều dài $${a}$ cm, chiều rộng $${b}$ cm, chiều cao $${c}$ cm. Tính thể tích (cm³).`, answer: number(v), answer_display: `${v} cm³`, solution: [r`$V = ${a} \times ${b} \times ${c} = ${v}$ (cm³)`] };
    },
  },
];
