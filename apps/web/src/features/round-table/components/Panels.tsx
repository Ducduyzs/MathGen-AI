"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy, Crown, Orbit, RotateCcw, Skull, Sparkles, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math";
import { Button } from "@/components/ui/button";
import { NumberAnswer } from "@/features/practice";
import { parseNumber } from "@/lib/math-input";
import { cn, isTyping } from "@/lib/utils";
import type { ExamAnswer, TablePlayer, TableRoom } from "@/types/api";
import { SEAT_COLORS, nextRisk, shortName } from "../model";
import { SPIN_MS } from "./TableScene";

/** Khung kính mờ nổi trên cảnh 3D. */
export function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl bg-slate-950/70 text-slate-100 shadow-2xl ring-1 ring-white/15 backdrop-blur-md", className)}>{children}</div>;
}

/** 6 chấm: ô đã quay (tối) và ô còn lại; chữ là xác suất trúng ở lần quay tới. */
export function RiskMeter({ player, chambers }: { player: TablePlayer; chambers: number }) {
  return (
    <span className="flex items-center gap-1.5" title={`Lần quay tới: 1/${chambers - player.spins} khả năng trúng hố đen`}>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: chambers }, (_, i) => (
          <span key={i} className={cn("size-1.5 rounded-full", i < player.spins ? "bg-slate-600" : "bg-slate-200")} />
        ))}
      </span>
      <span className="text-[11px] text-slate-300 tabular-nums">
        {player.alive ? `1/${chambers - player.spins}` : "loại"}
      </span>
    </span>
  );
}

// ------------------------------------------------------------------ phòng chờ

export function LobbyPanel({ room, onStart, starting }: { room: TableRoom; onStart: () => void; starting: boolean }) {
  const me = room.players.find((p) => p.is_me)!;
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Không sao chép được, hãy đọc mã cho bạn.");
    }
  }
  return (
    <Glass className="w-full max-w-md p-6">
      <p className="text-sm text-slate-300">Mã bàn, gửi cho bạn để vào chơi cùng</p>
      <div className="mt-1 flex items-center gap-3">
        <span className="font-mono text-4xl font-bold tracking-[0.25em] text-white">{room.code}</span>
        <button onClick={copy} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Sao chép mã bàn">
          {copied ? <Check className="size-5 text-emerald-400" /> : <Copy className="size-5" />}
        </button>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, seat) => {
          const p = room.players.find((x) => x.seat === seat);
          return (
            <li key={seat} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEAT_COLORS[seat] }} aria-hidden />
              {p ? (
                <span className="min-w-0 truncate font-medium">
                  {shortName(p.name, p.is_bot)}
                  {p.is_me && " (bạn)"}
                  {p.is_host && <Crown className="ml-1 inline size-3.5 text-amber-300" aria-label="chủ bàn" />}
                </span>
              ) : (
                <span className="text-slate-400">Ghế trống</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-400">Ghế trống sẽ có máy ngồi thay khi bắt đầu.</p>
      {me.is_host ? (
        <Button className="mt-5 w-full" size="lg" onClick={onStart} loading={starting}>
          <Orbit className="size-5" aria-hidden /> Bắt đầu ván
        </Button>
      ) : (
        <p className="mt-5 rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-slate-300">Đang chờ chủ bàn bắt đầu…</p>
      )}
    </Glass>
  );
}

// ------------------------------------------------------------------ câu hỏi

export function QuestionPanel({
  room,
  leftMs,
  onAnswer,
  sending,
}: {
  room: TableRoom;
  leftMs: number;
  onAnswer: (a: ExamAnswer | null) => void;
  sending: boolean;
}) {
  const q = room.question!;
  const me = room.players.find((p) => p.is_me)!;
  const [value, setValue] = useState("");
  const total = room.answer_seconds * 1000;
  const warn = leftMs < 8000;
  const locked = me.answered || !me.alive || sending;

  useEffect(() => setValue(""), [q.id]);

  // Phím tắt A–D / 1–4 như Đấu trường
  useEffect(() => {
    if (q.type !== "choice" || locked) return;
    const keys = (q.choices ?? []).map((c) => c.key);
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const key = keys.includes(k) ? k : keys[Number(k) - 1];
      if (key) onAnswer({ type: "choice", value: key });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, locked, onAnswer]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (parseNumber(value) !== null) onAnswer({ type: "number", value: value.trim() });
  }

  return (
    <Glass className="w-full max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-3 text-sm">
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-semibold">
          Câu {room.round}/{room.rounds}
        </span>
        <span className="truncate text-slate-300">{q.skill.name}</span>
        <span className={cn("ml-auto flex items-center gap-1 font-bold tabular-nums", warn ? "animate-pulse text-rose-300" : "text-sky-200")} role="timer">
          <Timer className="size-4" aria-hidden /> {Math.ceil(leftMs / 1000)}s
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div className={cn("h-full rounded-full transition-[width] duration-300", warn ? "bg-rose-400" : "bg-sky-400")} style={{ width: `${(leftMs / total) * 100}%` }} />
      </div>

      <p className="mt-4 text-lg leading-relaxed text-white">
        <MathText text={q.statement} />
      </p>

      {!me.alive ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-violet-500/15 px-4 py-3 text-sm text-violet-200">
          <Skull className="size-4" aria-hidden /> Bạn đã bị hố đen hút. Hãy xem các bạn còn lại thi đấu nhé!
        </p>
      ) : me.answered ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
          <Check className="size-4" aria-hidden /> Đã gửi đáp án. Chờ mọi người…
        </p>
      ) : q.type === "choice" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(q.choices ?? []).map((c) => (
            <button
              key={c.key}
              disabled={locked}
              onClick={() => onAnswer({ type: "choice", value: c.key })}
              className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2.5 text-left ring-1 ring-white/15 transition hover:bg-sky-400/20 hover:ring-sky-300 disabled:opacity-60"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold">{c.key}</span>
              <MathText text={c.content} />
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-start gap-3 [&_input]:text-ink">
          <NumberAnswer prefix={q.answer_prefix} value={value} onChange={setValue} label={`Đáp án câu ${room.round}`} />
          <Button type="submit" loading={sending} disabled={parseNumber(value) === null}>
            Chốt đáp án
          </Button>
        </form>
      )}
      {me.alive && !me.answered && (
        <p className="mt-3 text-xs text-slate-400">
          Sai hoặc hết giờ phải quay vòng hố đen: lần tới có {Math.round(nextRisk(room.chambers, me.spins) * 100)}% khả năng bị loại.
        </p>
      )}
    </Glass>
  );
}

// ------------------------------------------------------------------ xem đáp án + vòng quay

export function RevealPanel({ room }: { room: TableRoom }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), SPIN_MS);
    return () => clearTimeout(t);
  }, [room.round]);
  const r = room.reveal!;
  return (
    <Glass className="w-full max-w-md p-5">
      <p className="text-sm text-slate-300">Đáp án đúng</p>
      <p className="mt-1 text-xl font-bold text-emerald-300">
        <MathText text={r.answer_display} />
      </p>
      <ul className="mt-4 space-y-2">
        {room.players
          .filter((p) => p.last)
          .map((p) => {
            const last = p.last!;
            return (
              <li key={p.seat} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEAT_COLORS[p.seat] }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {shortName(p.name, p.is_bot)}
                  {p.is_me && " (bạn)"}
                </span>
                {last.correct ? (
                  <span className="font-semibold text-emerald-300">Đúng · +{last.points}</span>
                ) : !settled ? (
                  <span className="flex items-center gap-1 font-semibold text-amber-300">
                    <RotateCcw className="size-3.5 animate-spin" aria-hidden /> Đang quay…
                  </span>
                ) : last.hit ? (
                  <span className="flex items-center gap-1 font-semibold text-violet-300">
                    <Skull className="size-3.5" aria-hidden /> Trúng hố đen!
                  </span>
                ) : (
                  <span className="font-semibold text-sky-200">Sai · thoát nạn</span>
                )}
              </li>
            );
          })}
      </ul>
    </Glass>
  );
}

// ------------------------------------------------------------------ kết thúc

export function FinishPanel({ room, onReplay, replaying }: { room: TableRoom; onReplay: () => void; replaying: boolean }) {
  const ranked = [...room.players].sort(
    (a, b) => Number(b.alive) - Number(a.alive) || (b.out_round ?? 0) - (a.out_round ?? 0) || b.score - a.score,
  );
  const iWon = room.winners.includes(room.my_seat);
  const me = room.players.find((p) => p.is_me)!;
  return (
    <Glass className="w-full max-w-md p-6">
      <p className="flex items-center gap-2 text-2xl font-bold text-white">
        {iWon ? <Crown className="size-7 text-amber-300" aria-hidden /> : <Sparkles className="size-7 text-sky-300" aria-hidden />}
        {iWon ? "Bạn trụ vững tới cuối!" : "Ván đấu kết thúc"}
      </p>
      <ol className="mt-4 space-y-2">
        {ranked.map((p, i) => (
          <li key={p.seat} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", p.is_me ? "bg-sky-400/15 ring-1 ring-sky-300/40" : "bg-white/5")}>
            <span className="w-5 text-center font-bold text-slate-300">{i + 1}</span>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEAT_COLORS[p.seat] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {shortName(p.name, p.is_bot)}
              {p.is_me && " (bạn)"}
              {room.winners.includes(p.seat) && <Crown className="ml-1 inline size-3.5 text-amber-300" aria-label="thắng" />}
            </span>
            <span className="text-xs text-slate-400">{p.alive ? "trụ lại" : `loại ở câu ${p.out_round}`}</span>
            <span className="w-14 text-right font-semibold tabular-nums">{p.score}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-400">
        Bạn đúng {me.correct} câu. Các câu đã làm được tính vào XP, nhiệm vụ và chuỗi ngày học.
      </p>
      <div className="mt-5 flex gap-2">
        <Button className="flex-1" onClick={onReplay} loading={replaying}>
          <RotateCcw className="size-4" aria-hidden /> Ván mới
        </Button>
        <Link href="/games/round-table" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-[15px] font-medium hover:bg-white/20">
          <Users className="size-4" aria-hidden /> Về sảnh
        </Link>
      </div>
    </Glass>
  );
}

// ------------------------------------------------------------------ dải người chơi

export function PlayerStrip({ room }: { room: TableRoom }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {room.players.map((p) => (
        <li
          key={p.seat}
          className={cn(
            "rounded-xl bg-slate-950/65 px-3 py-2 text-slate-100 ring-1 backdrop-blur-md",
            p.is_me ? "ring-sky-300/60" : "ring-white/10",
            !p.alive && "opacity-55",
          )}
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEAT_COLORS[p.seat] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">
              {shortName(p.name, p.is_bot)}
              {p.is_me && " (bạn)"}
            </span>
            <span className="font-bold tabular-nums">{p.score}</span>
          </div>
          {room.phase !== "lobby" && (
            <div className="mt-1">
              <RiskMeter player={p} chambers={room.chambers} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
