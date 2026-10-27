"use client";

import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { GRADES } from "@/lib/grades";
import type { CrawlLicense } from "@/types/api";
import { useCreateCrawlSource } from "../api";
import { LICENSE_OPTIONS, lines } from "../model";

/** Thêm nguồn: quản trị viên khai báo phạm vi, giấy phép và xác nhận đã kiểm tra điều khoản của nguồn. */
export function SourceForm({ onDone }: { onDone: () => void }) {
  const create = useCreateCrawlSource();
  const [name, setName] = useState("");
  const [urls, setUrls] = useState("");
  const [paths, setPaths] = useState("");
  const [license, setLicense] = useState<CrawlLicense>("government");
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("");
  const [grades, setGrades] = useState<[number, number]>([1, 12]);
  const [maxPages, setMaxPages] = useState(50);
  const [depth, setDepth] = useState(2);
  const [delay, setDelay] = useState(3);
  const [confirm, setConfirm] = useState(false);
  const needNote = license === "permission";
  const hint = LICENSE_OPTIONS.find((o) => o.value === license)?.hint;

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name: name.trim(), start_urls: lines(urls), include_paths: lines(paths), license, permission_note: note.trim() || undefined,
        terms_url: terms.trim() || undefined, grade_min: grades[0], grade_max: grades[1], max_pages: maxPages, max_depth: depth,
        delay_seconds: delay, confirm: true,
      },
      {
        onSuccess: (s) => {
          toast.success(`Đã thêm nguồn ${s.domain}`);
          onDone();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  const valid = name.trim().length >= 2 && lines(urls).length > 0 && confirm && (!needNote || note.trim());

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>Thêm nguồn được phép</CardTitle>
      <CardDescription>Mỗi nguồn là một tên miền. Bộ gom chỉ đi trong các thư mục khai báo và luôn tuân thủ robots.txt.</CardDescription>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="cs-name">Tên nguồn</Label>
          <Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Đề thi tốt nghiệp THPT – Bộ GD&ĐT" />
        </div>
        <div>
          <Label htmlFor="cs-urls">Trang bắt đầu (mỗi dòng một URL, cùng tên miền)</Label>
          <Textarea id="cs-urls" value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://…/de-thi/" className="min-h-20 font-mono text-sm" />
        </div>
        <div>
          <Label htmlFor="cs-paths">Chỉ thu thập trong thư mục (tùy chọn)</Label>
          <Textarea id="cs-paths" value={paths} onChange={(e) => setPaths(e.target.value)} placeholder="/de-thi/" className="min-h-20 font-mono text-sm" />
        </div>
        <div>
          <Label htmlFor="cs-license">Giấy phép / căn cứ được phép</Label>
          <Select id="cs-license" value={license} onChange={(e) => setLicense(e.target.value as CrawlLicense)}>
            {LICENSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-muted">{hint}</p>
        </div>
        <div>
          <Label htmlFor="cs-terms">Trang điều khoản / giấy phép của nguồn (tùy chọn)</Label>
          <Input id="cs-terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="https://…/dieu-khoan" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cs-note">Bằng chứng cho phép {needNote ? "(bắt buộc)" : "(tùy chọn)"}</Label>
          <Textarea id="cs-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Số văn bản, email đồng ý của chủ sở hữu, ngày…" className="min-h-16" />
          {needNote && !note.trim() && <FieldError message="Cần ghi bằng chứng cho phép để lưu nguồn." />}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-5">
          <div>
            <Label htmlFor="cs-gmin">Từ lớp</Label>
            <Select id="cs-gmin" value={grades[0]} onChange={(e) => setGrades([Number(e.target.value), Math.max(grades[1], Number(e.target.value))])}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cs-gmax">Đến lớp</Label>
            <Select id="cs-gmax" value={grades[1]} onChange={(e) => setGrades([Math.min(grades[0], Number(e.target.value)), Number(e.target.value)])}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cs-pages">Tối đa trang</Label>
            <Input id="cs-pages" type="number" min={1} max={500} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="cs-depth">Độ sâu liên kết</Label>
            <Input id="cs-depth" type="number" min={0} max={5} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="cs-delay">Giãn cách (giây)</Label>
            <Input id="cs-delay" type="number" min={1} max={60} step={0.5} value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-ink sm:col-span-2">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span>
            Tôi xác nhận đã đọc điều khoản sử dụng của nguồn và nguồn <strong>cho phép thu thập, sử dụng lại</strong> nội dung theo giấy phép đã chọn.
            Bài thu được chỉ vào hàng chờ duyệt, kèm đường dẫn và giấy phép gốc.
          </span>
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={create.isPending} disabled={!valid}>
            <ShieldCheck className="size-4" aria-hidden /> Lưu nguồn
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Hủy
          </Button>
        </div>
      </form>
    </Card>
  );
}
