"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { MathRenderer } from "@/components/math";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseNumber } from "@/lib/math-input";

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

export function SetAnswer({ values, onChange, disabled }: Props) {
  const [draft, setDraft] = useState("");
  const invalid = draft.trim() !== "" && parseNumber(draft) === null;

  function add() {
    const v = draft.trim();
    if (!v || parseNumber(v) === null) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }

  // Giá trị đã qua parseNumber nên chỉ gồm chữ số, dấu, "/", "," — an toàn để ghép vào LaTeX.
  const preview = `S = \\left\\{ ${values.length ? values.join(";\\ ") : "\\ldots"} \\right\\}`;

  return (
    <div className="space-y-3">
      <div className="text-lg">
        <MathRenderer latex={preview} />
      </div>

      {!disabled && (
        <div className="flex max-w-sm gap-2">
          <Input
            aria-label="Thêm nghiệm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Nhập một nghiệm"
            autoComplete="off"
            aria-invalid={invalid}
          />
          <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim() || invalid}>
            <Plus className="size-4" aria-hidden />
            Thêm
          </Button>
        </div>
      )}

      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pr-1.5 pl-3 text-brand-800 ring-1 ring-brand-200">
              <MathRenderer latex={v} />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  className="grid size-6 place-items-center rounded-full hover:bg-brand-100"
                  aria-label={`Xóa nghiệm ${v}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <p className={invalid ? "text-sm text-danger-600" : "text-sm text-muted"}>
          {invalid ? "Số chưa đúng định dạng." : "Nhập từng nghiệm rồi bấm Thêm hoặc Enter. Chấp nhận phân số như -3/2."}
        </p>
      )}
    </div>
  );
}
