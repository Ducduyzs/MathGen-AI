import { MapPin } from "lucide-react";
import type { ExamRegion } from "@/types/api";

/** "Nghệ An · Trường THPT Chuyên Phan Bội Châu · Cuối học kì · 2025" (tỉnh cũ ghi kèm: "TP. Hồ Chí Minh (Bình Dương cũ)"). */
export function regionText(r: Partial<ExamRegion> | null | undefined) {
  if (!r) return "";
  const province = r.province_name
    ? r.province_raw && r.province_raw !== r.province_name
      ? `${r.province_name} (${r.province_raw} cũ)`
      : r.province_name
    : null;
  return [province, r.school_name, r.exam_kind_label, r.exam_year ? `năm học ${r.exam_year - 1}–${r.exam_year}` : null].filter(Boolean).join(" · ");
}

export function RegionLabel({ region, className }: { region: Partial<ExamRegion> | null | undefined; className?: string }) {
  const text = regionText(region);
  if (!text) return null;
  return (
    <span className={className ?? "inline-flex items-center gap-1 text-xs text-muted"}>
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      {text}
    </span>
  );
}
