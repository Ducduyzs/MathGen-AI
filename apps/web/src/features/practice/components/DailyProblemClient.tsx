"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleX } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceAnswer, type ChoiceOption } from "./ChoiceAnswer";

interface Props {
  statement: ReactNode;
  choices: ChoiceOption[];
  solution: ReactNode;
  answer: string;
  skill: string;
}

export function DailyProblemClient({ statement, choices, solution, answer, skill }: Props) {
  const [picked, setPicked] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = picked === answer;

  return (
    <Card className="p-6 sm:p-8">
      <p className="text-lg leading-relaxed text-ink">{statement}</p>
      <div className="mt-5">
        <ChoiceAnswer
          name="daily-problem"
          choices={choices}
          value={picked}
          onChange={setPicked}
          disabled={checked}
          correctKey={checked ? answer : undefined}
        />
      </div>

      {checked ? (
        <div className="mt-5 space-y-4" role="status">
          <p className={correct ? "font-semibold text-success-700" : "font-semibold text-danger-700"}>
            <span className="inline-flex items-center gap-2">
              {correct ? <CircleCheck className="size-5" aria-hidden /> : <CircleX className="size-5" aria-hidden />}
              {correct ? "Chính xác!" : "Chưa đúng rồi."}
            </span>{" "}
            <span className="font-normal text-ink">{solution}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/practice?skill=${skill}`} className={buttonClasses()}>
              Luyện thêm dạng này <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                setPicked("");
                setChecked(false);
              }}
            >
              Làm lại
            </Button>
          </div>
        </div>
      ) : (
        <Button className="mt-5" disabled={!picked} onClick={() => setChecked(true)}>
          Kiểm tra
        </Button>
      )}
    </Card>
  );
}
