"use client";

import { useState } from "react";
import { BookOpenCheck, GraduationCap, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExamBuilder } from "./ExamBuilder";
import { OfficialExamCard } from "./OfficialExamCard";
import { SimilarExamBuilder } from "./SimilarExamBuilder";

const TABS = [
  { key: "practice", label: "Đề ôn tập", hint: "Tự chọn số câu, chủ đề", icon: BookOpenCheck },
  { key: "official", label: "Đề thi", hint: "Chuẩn cấu trúc Bộ GD&ĐT", icon: GraduationCap },
  { key: "similar", label: "Từ đề thầy cô", hint: "Chụp đề, sinh đề tương tự", icon: Wand2 },
] as const;

export function ExamHub() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("practice");

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Loại đề" className="grid grid-cols-1 gap-2 rounded-2xl bg-brand-50 p-1.5 min-[480px]:grid-cols-3 sm:inline-grid sm:w-auto">
        {TABS.map((t) => {
          const selected = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-colors",
                "focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none",
                selected ? "bg-white shadow-sm" : "hover:bg-white/60",
              )}
            >
              <t.icon className={cn("size-5 shrink-0", selected ? "text-brand-600" : "text-muted")} aria-hidden />
              <span>
                <span className={cn("block text-sm font-semibold", selected ? "text-ink" : "text-muted")}>{t.label}</span>
                <span className="block text-xs text-muted">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{tab === "practice" ? <ExamBuilder /> : tab === "official" ? <OfficialExamCard /> : <SimilarExamBuilder />}</div>
    </div>
  );
}
