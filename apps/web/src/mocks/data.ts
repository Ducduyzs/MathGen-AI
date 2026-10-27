// Dữ liệu mẫu cho mock API. Chỉ dùng khi MOCK_API=1.
import type { AnswerValue, PublicProblem, ReviewItem, Role, Skill } from "@/types/api";

const r = String.raw;

export const SKILLS: Skill[] = [
  { code: "linear_equation", name: "Phương trình bậc nhất" },
  { code: "factorization", name: "Phân tích nhân tử" },
  { code: "quadratic_equation", name: "Phương trình bậc hai" },
  { code: "inequality", name: "Bất phương trình" },
  { code: "function", name: "Hàm số" },
  // Lớp 10–12 (đề thi tốt nghiệp THPT)
  { code: "calculus", name: "Đạo hàm – Tích phân" },
  { code: "exp_log", name: "Mũ – Logarit" },
  { code: "sequences", name: "Dãy số – Cấp số" },
  { code: "geometry_space", name: "Hình học không gian" },
  { code: "coordinates_3d", name: "Tọa độ Oxyz" },
  { code: "probability_statistics", name: "Xác suất – Thống kê" },
];

const skill = (code: string) => SKILLS.find((s) => s.code === code)!;

export interface MockProblem extends PublicProblem {
  answer: AnswerValue;
  answer_display: string;
  solution: string[];
}

export const PROBLEMS: MockProblem[] = [
  {
    id: "p01", grade: 6, skill: skill("linear_equation"), difficulty: 0.1,
    statement: r`Tìm $x$, biết $x - 15 = 27$.`,
    answer_type: "number", answer_prefix: "x =", answer: { type: "number", value: "42" }, answer_display: r`$x = 42$`,
    hints: [r`Chuyển $-15$ sang vế phải và đổi dấu.`],
    solution: [r`$x = 27 + 15$`, r`$x = 42$`],
  },
  {
    id: "p02", grade: 7, skill: skill("linear_equation"), difficulty: 0.2,
    statement: r`Tìm $x$, biết $\dfrac{x}{4} = \dfrac{3}{2}$.`,
    answer_type: "number", answer_prefix: "x =", answer: { type: "number", value: "6" }, answer_display: r`$x = 6$`,
    hints: ["Nhân cả hai vế với 4."],
    solution: [r`$x = \dfrac{3}{2} \cdot 4 = 6$`],
  },
  {
    id: "p03", grade: 8, skill: skill("linear_equation"), difficulty: 0.25,
    statement: r`Giải phương trình $x + 2 = 5$.`,
    answer_type: "number", answer_prefix: "x =", answer: { type: "number", value: "3" }, answer_display: r`$x = 3$`,
    solution: [r`$x = 5 - 2 = 3$`],
  },
  {
    id: "p04", grade: 8, skill: skill("linear_equation"), difficulty: 0.4,
    statement: r`Giải phương trình $3(x - 2) = 2x + 1$.`,
    answer_type: "number", answer_prefix: "x =", answer: { type: "number", value: "7" }, answer_display: r`$x = 7$`,
    hints: ["Phá ngoặc rồi chuyển các hạng tử chứa $x$ về một vế."],
    solution: [r`$3x - 6 = 2x + 1$`, r`$3x - 2x = 1 + 6$`, r`$x = 7$`],
  },
  {
    id: "p05", grade: 8, skill: skill("linear_equation"), difficulty: 0.6,
    statement: r`Giải phương trình $\dfrac{2x - 1}{3} - \dfrac{x + 2}{4} = 5$.`,
    answer_type: "number", answer_prefix: "x =", answer: { type: "number", value: "14" }, answer_display: r`$x = 14$`,
    hints: ["Quy đồng với mẫu chung là 12.", r`Sau khi nhân 12: $4(2x - 1) - 3(x + 2) = 60$. Phá ngoặc và thu gọn.`],
    solution: [r`Nhân hai vế với 12: $4(2x - 1) - 3(x + 2) = 60$`, r`$8x - 4 - 3x - 6 = 60$`, r`$5x = 70 \Rightarrow x = 14$`],
  },
  {
    id: "p06", grade: 8, skill: skill("factorization"), difficulty: 0.3,
    statement: r`Phân tích đa thức $x^2 - 9$ thành nhân tử.`,
    answer_type: "choice",
    choices: [
      { key: "A", content: r`$(x - 3)^2$` },
      { key: "B", content: r`$(x - 3)(x + 3)$` },
      { key: "C", content: r`$(x - 9)(x + 1)$` },
      { key: "D", content: r`$x(x - 9)$` },
    ],
    answer: { type: "choice", value: "B" }, answer_display: r`B. $(x - 3)(x + 3)$`,
    hints: [r`Dùng hằng đẳng thức $a^2 - b^2 = (a - b)(a + b)$.`],
    solution: [r`$x^2 - 9 = x^2 - 3^2 = (x - 3)(x + 3)$`],
  },
  {
    id: "p07", grade: 8, skill: skill("factorization"), difficulty: 0.5,
    statement: r`Phân tích đa thức $x^2 - 5x + 6$ thành nhân tử.`,
    answer_type: "choice",
    choices: [
      { key: "A", content: r`$(x - 2)(x - 3)$` },
      { key: "B", content: r`$(x + 2)(x + 3)$` },
      { key: "C", content: r`$(x - 1)(x - 6)$` },
      { key: "D", content: r`$(x + 1)(x - 6)$` },
    ],
    answer: { type: "choice", value: "A" }, answer_display: r`A. $(x - 2)(x - 3)$`,
    hints: ["Tìm hai số có tổng bằng 5 và tích bằng 6."],
    solution: [r`$x^2 - 5x + 6 = x^2 - 2x - 3x + 6$`, r`$= x(x - 2) - 3(x - 2) = (x - 2)(x - 3)$`],
  },
  {
    id: "p08", grade: 8, skill: skill("factorization"), difficulty: 0.65,
    statement: r`Phân tích đa thức $x^3 - 4x$ thành nhân tử.`,
    answer_type: "choice",
    choices: [
      { key: "A", content: r`$x(x - 4)$` },
      { key: "B", content: r`$x(x - 2)^2$` },
      { key: "C", content: r`$x(x - 2)(x + 2)$` },
      { key: "D", content: r`$(x - 2)(x + 2)$` },
    ],
    answer: { type: "choice", value: "C" }, answer_display: r`C. $x(x - 2)(x + 2)$`,
    hints: [r`Đặt $x$ làm nhân tử chung trước.`],
    solution: [r`$x^3 - 4x = x(x^2 - 4)$`, r`$= x(x - 2)(x + 2)$`],
  },
  {
    id: "p09", grade: 9, skill: skill("quadratic_equation"), difficulty: 0.4,
    statement: r`Giải phương trình $x^2 - 5x + 6 = 0$.`,
    answer_type: "set", answer: { type: "set", value: ["2", "3"] }, answer_display: r`$S = \{2;\ 3\}$`,
    hints: [r`Xác định $a = 1$, $b = -5$, $c = 6$.`, r`Tính $\Delta = b^2 - 4ac$, rồi dùng $x = \dfrac{-b \pm \sqrt{\Delta}}{2a}$.`],
    solution: [r`$\Delta = 25 - 24 = 1$`, r`$x_1 = \dfrac{5 + 1}{2} = 3$, $x_2 = \dfrac{5 - 1}{2} = 2$`],
  },
  {
    id: "p10", grade: 9, skill: skill("quadratic_equation"), difficulty: 0.45,
    statement: r`Giải phương trình $x^2 - 7x + 12 = 0$.`,
    answer_type: "set", answer: { type: "set", value: ["3", "4"] }, answer_display: r`$S = \{3;\ 4\}$`,
    solution: [r`$\Delta = 49 - 48 = 1$`, r`$x_1 = 4$, $x_2 = 3$`],
  },
  {
    id: "p11", grade: 9, skill: skill("quadratic_equation"), difficulty: 0.5,
    statement: r`Giải phương trình $x^2 + x - 6 = 0$.`,
    answer_type: "set", answer: { type: "set", value: ["2", "-3"] }, answer_display: r`$S = \{-3;\ 2\}$`,
    solution: [r`$\Delta = 1 + 24 = 25$`, r`$x_1 = \dfrac{-1 + 5}{2} = 2$, $x_2 = \dfrac{-1 - 5}{2} = -3$`],
  },
  {
    id: "p12", grade: 9, skill: skill("quadratic_equation"), difficulty: 0.75,
    statement: r`Tìm $m$ để phương trình $x^2 - 5x + m = 0$ có hai nghiệm phân biệt.`,
    answer_type: "choice",
    choices: [
      { key: "A", content: r`$m < \dfrac{25}{4}$` },
      { key: "B", content: r`$m > \dfrac{25}{4}$` },
      { key: "C", content: r`$m \le \dfrac{25}{4}$` },
      { key: "D", content: r`$m < 5$` },
    ],
    answer: { type: "choice", value: "A" }, answer_display: r`A. $m < \dfrac{25}{4}$`,
    hints: [r`Phương trình bậc hai có hai nghiệm phân biệt khi $\Delta > 0$.`, r`Ở đây $\Delta = (-5)^2 - 4 \cdot 1 \cdot m = 25 - 4m$.`],
    solution: [r`$\Delta = 25 - 4m$`, r`$\Delta > 0 \Leftrightarrow m < \dfrac{25}{4}$`],
  },
  {
    id: "p13", grade: 8, skill: skill("inequality"), difficulty: 0.3,
    statement: r`Giải bất phương trình $2x - 3 > 5$.`,
    answer_type: "choice",
    choices: [
      { key: "A", content: r`$x > 4$` },
      { key: "B", content: r`$x < 4$` },
      { key: "C", content: r`$x > 1$` },
      { key: "D", content: r`$x \ge 4$` },
    ],
    answer: { type: "choice", value: "A" }, answer_display: r`A. $x > 4$`,
    solution: [r`$2x > 8$`, r`$x > 4$`],
  },
  {
    id: "p14", grade: 8, skill: skill("inequality"), difficulty: 0.5,
    statement: r`Giải bất phương trình $-3x + 2 \le 11$.`,
    answer_type: "choice",
    choices: [
      { key: "A", content: r`$x \le -3$` },
      { key: "B", content: r`$x \ge -3$` },
      { key: "C", content: r`$x \ge 3$` },
      { key: "D", content: r`$x \le 3$` },
    ],
    answer: { type: "choice", value: "B" }, answer_display: r`B. $x \ge -3$`,
    hints: [r`Chuyển $2$ sang vế phải: $-3x \le 9$.`, "Khi chia hai vế cho số âm, phải đổi chiều bất đẳng thức."],
    solution: [r`$-3x \le 9$`, r`Chia hai vế cho $-3$ và đổi chiều: $x \ge -3$`],
  },
  {
    id: "p15", grade: 10, skill: skill("inequality"), difficulty: 0.65,
    statement: r`Tập nghiệm của bất phương trình $x^2 - 4 < 0$ là`,
    answer_type: "choice",
    choices: [
      { key: "A", content: r`$(-2;\ 2)$` },
      { key: "B", content: r`$(-\infty;\ -2) \cup (2;\ +\infty)$` },
      { key: "C", content: r`$[-2;\ 2]$` },
      { key: "D", content: r`$(0;\ 2)$` },
    ],
    answer: { type: "choice", value: "A" }, answer_display: r`A. $(-2;\ 2)$`,
    hints: [r`Tam thức bậc hai trái dấu với hệ số $a$ trong khoảng hai nghiệm.`],
    solution: [r`$x^2 - 4 = 0 \Leftrightarrow x = \pm 2$`, r`$a = 1 > 0$ nên $x^2 - 4 < 0 \Leftrightarrow -2 < x < 2$`],
  },
  {
    id: "p16", grade: 9, skill: skill("function"), difficulty: 0.3,
    statement: r`Cho hàm số $y = 2x + 3$. Tính giá trị của $y$ khi $x = -1$.`,
    answer_type: "number", answer_prefix: "y =", answer: { type: "number", value: "1" }, answer_display: r`$y = 1$`,
    solution: [r`$y = 2 \cdot (-1) + 3 = 1$`],
  },
  {
    id: "p17", grade: 10, skill: skill("function"), difficulty: 0.55,
    statement: r`Tọa độ đỉnh của parabol $y = x^2 - 4x + 1$ là`,
    answer_type: "choice",
    choices: [
      { key: "A", content: r`$(2;\ -3)$` },
      { key: "B", content: r`$(-2;\ 13)$` },
      { key: "C", content: r`$(2;\ 3)$` },
      { key: "D", content: r`$(4;\ 1)$` },
    ],
    answer: { type: "choice", value: "A" }, answer_display: r`A. $(2;\ -3)$`,
    hints: [r`Hoành độ đỉnh $x = -\dfrac{b}{2a}$.`, r`Thay hoành độ vừa tìm vào $y = x^2 - 4x + 1$ để có tung độ.`],
    solution: [r`$x = -\dfrac{-4}{2} = 2$`, r`$y = 4 - 8 + 1 = -3$`],
  },
  {
    id: "p18", grade: 10, skill: skill("function"), difficulty: 0.7,
    statement: r`Cho hàm số $f(x) = x^2 - 3x$. Tính $f\left(\dfrac{1}{2}\right)$.`,
    answer_type: "number", answer_prefix: r`f\left(\dfrac{1}{2}\right) =`,
    answer: { type: "number", value: "-5/4" }, answer_display: r`$-\dfrac{5}{4}$`,
    hints: [r`Thay $x = \dfrac{1}{2}$ vào biểu thức.`],
    solution: [r`$f\left(\dfrac{1}{2}\right) = \dfrac{1}{4} - \dfrac{3}{2} = -\dfrac{5}{4}$`],
  },
];

export interface MockUser {
  id: string;
  email: string;
  password: string;
  full_name: string;
  role: Role;
  grade: number | null;
  /** Phụ huynh mẫu: theo dõi sẵn học sinh có id này. */
  parent_of?: string;
}

export const USERS: MockUser[] = [
  { id: "u_student", email: "hs@mathgen.vn", password: "123456", full_name: "Nguyễn Minh An", role: "student", grade: 9 },
  { id: "u_teacher", email: "gv@mathgen.vn", password: "123456", full_name: "Trần Thu Hà", role: "teacher", grade: null },
  { id: "u_admin", email: "admin@mathgen.vn", password: "123456", full_name: "Quản trị hệ thống", role: "admin", grade: null },
  { id: "u_parent", email: "ph@mathgen.vn", password: "123456", full_name: "Nguyễn Văn Bình", role: "parent", grade: null, parent_of: "u_student" },
];

/** Hồ sơ năng lực ban đầu của học sinh mẫu (giống ví dụ trong đề tài). */
export const SEED_SCORES: Record<string, { score: number; n: number }> = {
  linear_equation: { score: 0.92, n: 24 },
  factorization: { score: 0.78, n: 18 },
  quadratic_equation: { score: 0.61, n: 15 },
  inequality: { score: 0.43, n: 9 },
  function: { score: 0.37, n: 7 },
};

export const SEED_TOTALS = { total: 73, correct: 51 };

export const DAILY_GOAL = 5;

/** Học sinh mẫu đã giữ chuỗi 4 ngày và hôm nay làm được 2 bài. */
export const SEED_DAILY = { count: 2, streakBefore: 4 };

export const SEED_ATTEMPTS = [
  { problem_id: "p09", is_correct: true, minutesAgo: 35 },
  { problem_id: "p14", is_correct: false, minutesAgo: 50 },
  { problem_id: "p06", is_correct: true, minutesAgo: 60 * 26 },
  { problem_id: "p17", is_correct: false, minutesAgo: 60 * 27 },
];

const parent = PROBLEMS.find((p) => p.id === "p09")!;

export const REVIEW_QUEUE: ReviewItem[] = [
  {
    id: "rv1", origin: "generated", grade: 9, skill: skill("quadratic_equation"), difficulty: 0.45, classification_confidence: 0.97,
    parent: { id: parent.id, statement: parent.statement },
    transform: r`giữ dạng $x^2 + bx + c = 0$, đổi $b = -7$, $c = 13$`,
    statement: r`Giải phương trình $x^2 - 7x + 13 = 0$.`,
    answer_display: r`Vô nghiệm ($\Delta = -3 < 0$)`,
    solution: [r`$\Delta = 49 - 52 = -3 < 0$`, "Phương trình vô nghiệm."],
    checks: [
      { label: r`Giải bằng SymPy: $\Delta = -3$, không có nghiệm thực`, passed: true },
      { label: "Không thỏa ràng buộc của luật: yêu cầu nghiệm nguyên", passed: false },
      { label: "Không trùng bài trong ngân hàng (canonical hash)", passed: true },
    ],
  },
  {
    id: "rv2", origin: "generated", grade: 9, skill: skill("quadratic_equation"), difficulty: 0.5, classification_confidence: 0.96,
    parent: { id: parent.id, statement: parent.statement },
    transform: "nhân hai vế với 2",
    statement: r`Giải phương trình $2x^2 - 10x + 12 = 0$.`,
    answer_display: r`$S = \{2;\ 3\}$`,
    solution: [r`Chia hai vế cho 2: $x^2 - 5x + 6 = 0$`, r`$x_1 = 3$, $x_2 = 2$`],
    checks: [
      { label: r`Giải bằng SymPy: $x = 2$, $x = 3$`, passed: true },
      { label: "Thỏa ràng buộc: nghiệm nguyên", passed: true },
      { label: "Gần trùng: tương đương bài gốc sau khi rút gọn hệ số chung", passed: false },
    ],
  },
  {
    id: "rv3", origin: "generated", grade: 9, skill: skill("quadratic_equation"), difficulty: 0.72, classification_confidence: 0.93,
    parent: { id: parent.id, statement: parent.statement },
    transform: r`thay $c$ bằng tham số $m$`,
    statement: r`Tìm $m$ để phương trình $x^2 - 5x + m = 0$ có nghiệm kép.`,
    answer_display: r`$m = \dfrac{25}{4}$`,
    solution: [r`Phương trình có nghiệm kép khi $\Delta = 0$`, r`$25 - 4m = 0 \Leftrightarrow m = \dfrac{25}{4}$`],
    checks: [
      { label: r`Giải bằng SymPy: $m = \dfrac{25}{4}$`, passed: true },
      { label: r`Kiểm tra lại: với $m = \dfrac{25}{4}$ phương trình có nghiệm kép $x = \dfrac{5}{2}$`, passed: true },
      { label: "Không trùng bài trong ngân hàng (canonical hash)", passed: true },
    ],
  },
  {
    id: "rv4", origin: "extracted", grade: 8, skill: skill("linear_equation"), difficulty: 0.45, classification_confidence: 0.62,
    source: { name: "de-kiem-tra-chuong-3-lop-8.pdf", page: 2 },
    statement: r`Giải phương trình $\dfrac{x + 1}{2} = \dfrac{2x - 1}{3}$.`,
    answer_display: r`$x = 5$`,
    solution: [r`$3(x + 1) = 2(2x - 1)$`, r`$3x + 3 = 4x - 2$`, r`$x = 5$`],
    checks: [
      { label: r`Giải bằng SymPy: $x = 5$`, passed: true },
      { label: "Đáp án trong tài liệu khớp với kết quả giải", passed: true },
      { label: "Không trùng bài trong ngân hàng (canonical hash)", passed: true },
    ],
  },
];
