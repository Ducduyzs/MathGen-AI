import { MathText } from "@/components/math";
import type { AnswerValue, AttemptResult, PublicProblem } from "@/types/api";
import { ChoiceAnswer } from "./ChoiceAnswer";
import { NumberAnswer } from "./NumberAnswer";
import { SetAnswer } from "./SetAnswer";

interface Props {
  problem: PublicProblem;
  value: AnswerValue | null;
  onChange: (value: AnswerValue) => void;
  result: AttemptResult | null;
}

/** Chọn ô nhập theo kiểu đáp án (khớp cách chấm của backend). */
export function AnswerInput({ problem, value, onChange, result }: Props) {
  const disabled = result !== null;
  switch (problem.answer_type) {
    case "choice":
      return (
        <ChoiceAnswer
          choices={(problem.choices ?? []).map((c) => ({ key: c.key, content: <MathText text={c.content} /> }))}
          value={value?.type === "choice" ? value.value : ""}
          onChange={(v) => onChange({ type: "choice", value: v })}
          disabled={disabled}
          correctKey={result?.correct_answer.type === "choice" ? result.correct_answer.value : undefined}
        />
      );
    case "number":
      return (
        <NumberAnswer
          prefix={problem.answer_prefix}
          value={value?.type === "number" ? value.value : ""}
          onChange={(v) => onChange({ type: "number", value: v })}
          disabled={disabled}
        />
      );
    case "set":
      return (
        <SetAnswer
          values={value?.type === "set" ? value.value : []}
          onChange={(v) => onChange({ type: "set", value: v })}
          disabled={disabled}
        />
      );
  }
}
