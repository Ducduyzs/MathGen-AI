import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DIFFICULTY_LEVELS } from "@/lib/utils";
import type { Skill } from "@/types/api";
import type { ProblemQuery } from "../api";

const GRADES = [6, 7, 8, 9, 10, 11, 12];

// Form GET thuần: lọc hoạt động cả khi chưa tải JS, URL chia sẻ được.
export function ProblemFilters({ skills, value }: { skills: Skill[]; value: ProblemQuery }) {
  return (
    <form
      action="/problems"
      method="get"
      className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_8.5rem_12rem_10rem_auto]"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input name="q" defaultValue={value.q} placeholder="Tìm theo nội dung đề…" aria-label="Từ khóa" className="pl-9" />
      </div>
      <Select name="grade" defaultValue={value.grade ?? ""} aria-label="Lớp">
        <option value="">Tất cả lớp</option>
        {GRADES.map((g) => (
          <option key={g} value={g}>
            Lớp {g}
          </option>
        ))}
      </Select>
      <Select name="skill" defaultValue={value.skill ?? ""} aria-label="Chủ đề">
        <option value="">Tất cả chủ đề</option>
        {skills.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select name="level" defaultValue={value.level ?? ""} aria-label="Mức độ">
        <option value="">Mọi mức độ</option>
        {DIFFICULTY_LEVELS.map((l) => (
          <option key={l.level} value={l.level}>
            {l.label}
          </option>
        ))}
      </Select>
      <Button type="submit">Lọc</Button>
    </form>
  );
}
