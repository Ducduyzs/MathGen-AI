import { Badge } from "@/components/ui/badge";
import { difficultyLevel } from "@/lib/utils";
import type { Skill } from "@/types/api";

export function ProblemMeta({ grade, skill, difficulty }: { grade: number; skill: Skill; difficulty: number }) {
  const level = difficultyLevel(difficulty);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="neutral">Lớp {grade}</Badge>
      <Badge tone="brand">{skill.name}</Badge>
      <Badge tone={level.tone}>{level.label}</Badge>
    </div>
  );
}
