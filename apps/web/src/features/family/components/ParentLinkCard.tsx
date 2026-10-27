"use client";

import { useState } from "react";
import { Check, Copy, HeartHandshake, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { errorMessage } from "@/lib/api/errors";
import { timeAgo } from "@/lib/utils";
import { useCreateLinkCode, useMyParents, useRemoveParent } from "../api";

const expiry = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

/** Học sinh tạo mã cho phụ huynh và quản lý phụ huynh đang theo dõi mình. */
export function ParentLinkCard() {
  const parents = useMyParents();
  const create = useCreateLinkCode();
  const remove = useRemoveParent();
  const [copied, setCopied] = useState(false);
  const code = create.data;

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Trình duyệt chặn sao chép. Hãy chọn và sao chép mã thủ công.");
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle className="flex items-center gap-2">
        <HeartHandshake className="size-4.5 text-brand-500" aria-hidden /> Phụ huynh theo dõi
      </CardTitle>
      <CardDescription className="mt-1">
        Bố mẹ xem được tiến độ, bài lớp giao và điểm các đề của bạn (chỉ xem, không làm bài thay). Tạo mã rồi gửi cho bố mẹ nhập ở tài
        khoản phụ huynh.
      </CardDescription>

      {code ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className="rounded-xl bg-brand-50 px-4 py-2 font-mono text-2xl font-bold tracking-[0.25em] text-brand-800 ring-1 ring-brand-200 select-all"
            aria-label={`Mã liên kết ${code.code.split("").join(" ")}`}
          >
            {code.code}
          </span>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="size-4 text-success-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Đã chép" : "Sao chép"}
          </Button>
          <p className="w-full text-sm text-muted">Dùng một lần, hết hạn lúc {expiry.format(new Date(code.expires_at))}.</p>
        </div>
      ) : (
        <Button
          className="mt-4"
          variant="secondary"
          loading={create.isPending}
          onClick={() => create.mutate(undefined, { onError: (err) => toast.error(errorMessage(err)) })}
        >
          Tạo mã liên kết
        </Button>
      )}

      {parents.data && parents.data.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {parents.data.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{p.full_name}</span>
                <span className="text-xs text-muted">
                  {p.email} · liên kết {timeAgo(p.linked_at)}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Gỡ liên kết ${p.full_name}`}
                loading={remove.isPending && remove.variables === p.id}
                onClick={() =>
                  remove.mutate(p.id, {
                    onSuccess: () => toast.success(`Đã gỡ liên kết với ${p.full_name}`),
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              >
                <UserMinus className="size-4" aria-hidden /> Gỡ
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
