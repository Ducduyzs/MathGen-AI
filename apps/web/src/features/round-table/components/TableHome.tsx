"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleDot, LogIn, Orbit, Skull, Timer, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input, Label } from "@/components/ui/input";
import { useAuth } from "@/features/auth";
import { errorMessage } from "@/lib/api/errors";
import { isPrimary } from "@/lib/grades";
import type { ArenaPool } from "@/types/api";
import { useCreateRoom, useJoinRoom } from "../api";

const RULES = [
  { icon: Users, text: "4 người ngồi quanh một bàn giữa không gian. Ghế trống có máy chơi thay." },
  { icon: Timer, text: "Mỗi lượt mọi người cùng trả lời một câu. Đúng được 100 điểm, càng nhanh thưởng thêm tới 50." },
  { icon: CircleDot, text: "Sai hoặc hết giờ: quay vòng hố đen 6 ô. Lần đầu 1/6 khả năng trúng, lần sau 1/5, rồi 1/4…" },
  { icon: Skull, text: "Trúng hố đen thì bị loại (vẫn được xem tiếp)." },
  { icon: Trophy, text: "Người cuối cùng trụ lại thắng. Hết số câu mà còn nhiều người: ai nhiều điểm hơn thắng." },
];

/** Sảnh Bàn tròn: tạo bàn mới hoặc vào bàn bằng mã của bạn. */
export function TableHome() {
  const router = useRouter();
  const create = useCreateRoom();
  const join = useJoinRoom();
  const { user } = useAuth();
  const [pool, setPool] = useState<ArenaPool>(() => (isPrimary(user?.grade) ? "primary" : "basic"));
  const [rounds, setRounds] = useState(10);
  const [code, setCode] = useState("");

  function onCreate() {
    create.mutate({ pool, rounds }, { onSuccess: (r) => router.push(`/games/round-table/${r.code}`), onError: (e) => toast.error(errorMessage(e)) });
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length < 5) return;
    join.mutate(code, { onSuccess: (r) => router.push(`/games/round-table/${r.code}`), onError: (err) => toast.error(errorMessage(err)) });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="relative bg-[radial-gradient(circle_at_30%_20%,#4c1d95_0,#0b0622_55%,#03050c_100%)] p-6 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:28px_28px] opacity-15" aria-hidden />
            <div className="relative">
              <p className="flex items-center gap-2 text-xl font-bold">
                <Orbit className="size-6 text-violet-300" aria-hidden /> Bàn tròn vũ trụ
              </p>
              <p className="mt-1 max-w-lg text-sm text-violet-100/90">Trả lời đúng để trụ lại. Sai là phải quay vòng hố đen, ai may mắn và giỏi nhất sẽ ở lại tới cuối.</p>
            </div>
          </div>
          <div className="space-y-5 p-6">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Bộ câu hỏi</p>
              <div className="flex flex-wrap gap-2">
                <Chip selected={pool === "primary"} onClick={() => setPool("primary")}>
                  Tiểu học (lớp 1–5) · 30 giây/câu
                </Chip>
                <Chip selected={pool === "basic"} onClick={() => setPool("basic")}>
                  Đại số (lớp 6–10) · 30 giây/câu
                </Chip>
                <Chip selected={pool === "thpt"} onClick={() => setPool("thpt")}>
                  Ôn thi THPT · 45 giây/câu
                </Chip>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Số câu tối đa</p>
              <div className="flex flex-wrap gap-2">
                {[10, 15, 20].map((n) => (
                  <Chip key={n} selected={rounds === n} onClick={() => setRounds(n)}>
                    {n} câu
                  </Chip>
                ))}
              </div>
            </div>
            <Button size="lg" onClick={onCreate} loading={create.isPending}>
              <Orbit className="size-5" aria-hidden /> Tạo bàn mới
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <CardTitle>Vào bàn của bạn</CardTitle>
          <CardDescription>Nhập mã 5 ký tự bạn bè gửi cho bạn.</CardDescription>
          <form onSubmit={onJoin} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="table-code">Mã bàn</Label>
              <Input
                id="table-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                placeholder="VD: K7QXM"
                className="w-40 font-mono text-lg tracking-widest uppercase"
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="secondary" loading={join.isPending} disabled={code.length < 5}>
              <LogIn className="size-4" aria-hidden /> Vào bàn
            </Button>
          </form>
        </Card>
      </div>

      <Card className="h-fit p-6">
        <CardTitle>Luật chơi</CardTitle>
        <ul className="mt-4 space-y-3">
          {RULES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm text-ink">
              <Icon className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Câu đã làm được tính XP, nhiệm vụ hằng ngày và chuỗi ngày học như Luyện tập.</p>
      </Card>
    </div>
  );
}
