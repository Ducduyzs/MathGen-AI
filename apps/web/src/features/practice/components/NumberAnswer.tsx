"use client";

import { useId } from "react";
import { MathRenderer } from "@/components/math";
import { Input } from "@/components/ui/input";
import { parseNumber } from "@/lib/math-input";

interface Props {
  prefix?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

export function NumberAnswer({ prefix, value, onChange, disabled, label = "Đáp án" }: Props) {
  const hintId = useId();
  const invalid = value.trim() !== "" && parseNumber(value) === null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {prefix && (
          <span className="text-lg">
            <MathRenderer latex={prefix} />
          </span>
        )}
        <Input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          inputMode="text"
          autoComplete="off"
          placeholder="Ví dụ: 3/2"
          aria-invalid={invalid}
          aria-describedby={hintId}
          className="max-w-48 text-lg"
        />
      </div>
      {!disabled && (
        <p id={hintId} className={invalid ? "mt-2 text-sm text-danger-600" : "mt-2 text-sm text-muted"}>
          {invalid ? "Số chưa đúng định dạng." : "Nhập số nguyên, số thập phân (1,5) hoặc phân số (3/2)."}
        </p>
      )}
    </div>
  );
}
