// Server Component: render công thức sẵn trên server rồi truyền xuống phần client,
// để trang chủ không phải tải thư viện KaTeX.
import { MathText } from "@/components/math";
import { DailyProblemClient } from "./DailyProblemClient";

const r = String.raw;

// Bài mẫu cho khách thử ngay trên trang chủ, không cần đăng nhập. Đáp án nằm sẵn ở client
// vì đây chỉ là bài trình diễn, không tính điểm.
const PROBLEM = {
  statement: r`Tìm $m$ để phương trình $x^2 - 5x + m = 0$ có hai nghiệm phân biệt.`,
  choices: [
    { key: "A", content: r`$m < \dfrac{25}{4}$` },
    { key: "B", content: r`$m > \dfrac{25}{4}$` },
    { key: "C", content: r`$m \le \dfrac{25}{4}$` },
    { key: "D", content: r`$m < 5$` },
  ],
  answer: "A",
  solution: r`Cần $\Delta = 25 - 4m > 0$, tức $m < \dfrac{25}{4}$.`,
  skill: "quadratic_equation",
};

export function DailyProblem() {
  return (
    <DailyProblemClient
      statement={<MathText text={PROBLEM.statement} />}
      choices={PROBLEM.choices.map((c) => ({ key: c.key, content: <MathText text={c.content} /> }))}
      solution={<MathText text={PROBLEM.solution} />}
      answer={PROBLEM.answer}
      skill={PROBLEM.skill}
    />
  );
}
