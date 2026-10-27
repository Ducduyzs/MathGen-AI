"use client";

import { MapPin } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { useProvinces, useSchools } from "@/features/regions";
import { PROVINCES_SORTED } from "@/lib/regions";

export interface RegionValue {
  province: string;
  school: string;
}

/** Đề theo khu vực: chọn tỉnh (và trường) để ưu tiên câu đề thật của khu vực đó; để trống = đề tự sinh như thường. */
export function RegionPicker({ value, onChange }: { value: RegionValue; onChange: (v: RegionValue) => void }) {
  const provinces = useProvinces();
  const schools = useSchools(value.province || null);
  const counts = new Map(provinces.data?.map((p) => [p.code, p.problems]) ?? []);
  const real = value.school ? schools.data?.find((s) => s.id === value.school)?.problems : counts.get(value.province);

  return (
    <section>
      <CardTitle className="flex items-center gap-2">
        <MapPin className="size-4.5 text-brand-500" aria-hidden /> Khu vực <span className="text-sm font-normal text-muted">(tùy chọn)</span>
      </CardTitle>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Select aria-label="Tỉnh/thành" value={value.province} onChange={(e) => onChange({ province: e.target.value, school: "" })}>
          <option value="">Không chọn: đề tự sinh</option>
          {PROVINCES_SORTED.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
              {counts.get(p.code) ? ` · ${counts.get(p.code)} câu đề thật` : ""}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Trường"
          value={value.school}
          disabled={!value.province || !schools.data?.length}
          onChange={(e) => onChange({ ...value, school: e.target.value })}
        >
          <option value="">{value.province && !schools.data?.length ? "Chưa có trường nào" : "Mọi trường trong tỉnh"}</option>
          {schools.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.problems ? ` · ${s.problems} câu` : ""}
            </option>
          ))}
        </Select>
      </div>
      {value.province && (
        <p className="mt-2 text-sm text-muted">
          {real
            ? `Ưu tiên ${real} câu thu thập từ đề thật của khu vực này; thiếu bao nhiêu thì bổ sung câu tự sinh cùng cấp học.`
            : "Khu vực này chưa có câu đề thật trong ngân hàng: đề sẽ gồm câu tự sinh."}
        </p>
      )}
    </section>
  );
}
