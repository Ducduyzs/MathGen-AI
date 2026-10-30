"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { useClassifierStatus, usePredict } from "../api";

const pct = (x?: number) => (x == null ? "—" : `${Math.round(x * 100)}%`);

/** Giáo viên dán vài đề (cách nhau bằng dòng trống) để xem mô hình đoán chủ đề, lớp, mức độ. */
export function ClassifyTry() {
  const status = useClassifierStatus();
  const predict = usePredict();
  const [text, setText] = useState("");
  const items = text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 20);
  const s = status.data;

  return (
    <Card className="p-5">
      <CardTitle className="flex items-center gap-2">
        <Sparkles className="size-4.5 text-violet-600" aria-hidden /> Phân loại đề bằng AI
      </CardTitle>
      <CardDescription>
        {s?.available
          ? `Mô hình ${s.base_model}: đúng chủ đề ${pct(s.real_test.topic_acc)}, cấp lớp ${pct(s.real_test.grade_band_acc)} trên đề thật chưa từng thấy.`
          : (s?.reason ?? "Đang kiểm tra mô hình…")}
      </CardDescription>
      {s?.available && (
        <>
          <Textarea
            className="mt-3 min-h-28 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Dán đề, mỗi đề cách nhau một dòng trống.\n\nCho tam giác ABC vuông tại A…\n\nTính đạo hàm của hàm số…"}
            aria-label="Đề cần phân loại"
          />
          <Button className="mt-3" size="sm" disabled={!items.length} loading={predict.isPending} onClick={() => predict.mutate(items)}>
            Phân loại {items.length || ""} đề
          </Button>
          {predict.isError && <p className="mt-2 text-sm text-danger-600">{errorMessage(predict.error)}</p>}
          {predict.data && (
            <ol className="mt-3 space-y-2 text-sm">
              {predict.data.map((p, i) => (
                <li key={i} className="rounded-xl bg-surface p-2.5">
                  <p className="line-clamp-2 text-muted">{items[i]}</p>
                  <p className="mt-1 font-medium text-ink">
                    {p.topic_label} · {p.grade ? `lớp ${p.grade}` : p.grade_band_label} · {p.level}
                  </p>
                  <p className="text-xs text-muted">
                    Tin cậy: chủ đề {pct(p.topic_confidence)} · cấp {pct(p.grade_band_confidence)} · lớp {pct(p.grade_confidence)} · độ khó {p.difficulty}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Card>
  );
}
