"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Move3d } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { ExamAnswer } from "@/types/api";
import { tableKeys, useAnswerRoom, useCreateRoom, useLeaveRoom, useRoom, useStartRoom } from "../api";
import { SKIES, useCountdown, useSky } from "../model";
import { FinishPanel, LobbyPanel, PlayerStrip, QuestionPanel, RevealPanel } from "./Panels";

// three.js chỉ chạy trên trình duyệt
const TableScene = dynamic(() => import("./TableScene").then((m) => m.TableScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-slate-400">Đang dựng không gian…</div>,
});

/** Màn chơi toàn màn hình: cảnh 3D phía sau, câu hỏi giữa màn hình, điểm từng người ở dưới. */
export function RoomView({ code }: { code: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: room, error } = useRoom(code);
  const [sky, setSky] = useSky();
  const [hidden, setHidden] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leftMs = useCountdown(room);
  const start = useStartRoom(code);
  const answer = useAnswerRoom(code);
  const create = useCreateRoom();
  const leave = useLeaveRoom(code);

  const onAnswer = useCallback(
    (given: ExamAnswer | null) => {
      if (!room || answer.isPending) return;
      answer.mutate(
        { round: room.round, answer: given },
        {
          onError: (err) => {
            // Hết giờ / sang câu khác / đã bị loại: lấy lại trạng thái bàn
            if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: tableKeys.room(code) });
            else toast.error(errorMessage(err));
          },
        },
      );
    },
    [room, answer, queryClient, code],
  );

  function exit() {
    leave.mutate(undefined, { onSettled: () => router.push("/games/round-table") });
  }

  function replay() {
    if (!room) return;
    create.mutate({ pool: room.pool, rounds: room.rounds }, { onSuccess: (r) => router.push(`/games/round-table/${r.code}`), onError: (e) => toast.error(errorMessage(e)) });
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-lg font-semibold text-ink">Không vào được bàn {code.toUpperCase()}</p>
        <p className="mt-1 text-muted">{error instanceof ApiError && error.status === 404 ? "Bàn không tồn tại, đã hết hạn hoặc bạn chưa vào bàn này." : errorMessage(error)}</p>
        <Link href="/games/round-table" className="mt-5 inline-block font-medium text-brand-700 hover:underline">
          Về sảnh Bàn tròn
        </Link>
      </div>
    );
  }

  const playing = room?.phase === "question" || room?.phase === "reveal";

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#03050c] text-white select-none">
      {room ? <TableScene room={room} sky={sky} /> : <LoaderCircle className="absolute top-1/2 left-1/2 size-8 -translate-1/2 animate-spin text-slate-400" />}

      {/* Thanh trên: rời bàn, mã bàn, chọn bầu trời */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <button
          onClick={() => (playing ? setLeaving(true) : exit())}
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-slate-950/65 px-3 py-2 text-sm font-medium ring-1 ring-white/15 backdrop-blur-md hover:bg-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden /> Rời bàn
        </button>
        {room && (
          <span className="rounded-xl bg-slate-950/65 px-3 py-2 text-sm ring-1 ring-white/15 backdrop-blur-md">
            Bàn <strong className="font-mono tracking-widest">{room.code}</strong>
            {room.phase !== "lobby" && (
              <span className="text-slate-300">
                {" "}· Câu {Math.min(room.round, room.rounds)}/{room.rounds}
              </span>
            )}
          </span>
        )}
        <div className="pointer-events-auto ml-auto flex rounded-xl bg-slate-950/65 p-1 ring-1 ring-white/15 backdrop-blur-md" role="radiogroup" aria-label="Bầu trời">
          {SKIES.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={sky === s.id}
              onClick={() => setSky(s.id)}
              className={cn("rounded-lg px-2.5 py-1 text-xs font-medium sm:text-sm", sky === s.id ? "bg-white text-slate-900" : "text-slate-300 hover:text-white")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Giữa màn hình: phòng chờ / câu hỏi / đáp án / kết quả. Vùng trống vẫn kéo được để nhìn quanh. */}
      {room && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-3 pt-16 pb-36 select-text sm:pb-28">
          <div className={cn("flex w-full justify-center [&>*]:pointer-events-auto", hidden && room.phase === "question" && "hidden")}>
            {room.phase === "lobby" && <LobbyPanel room={room} onStart={() => start.mutate()} starting={start.isPending} />}
            {room.phase === "question" && <QuestionPanel room={room} leftMs={leftMs} onAnswer={onAnswer} sending={answer.isPending} />}
            {room.phase === "reveal" && <RevealPanel room={room} />}
            {room.phase === "finished" && <FinishPanel room={room} onReplay={replay} replaying={create.isPending} />}
          </div>
        </div>
      )}

      {/* Dưới: điểm và độ nguy hiểm của từng người */}
      {room && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 rounded-full bg-slate-950/50 px-3 py-1 backdrop-blur">
              <Move3d className="size-3.5" aria-hidden /> Kéo để nhìn quanh<span className="max-sm:hidden"> · nhấp đúp để nhìn lại giữa bàn</span>
            </span>
            {room.phase === "question" && (
              <button
                onClick={() => setHidden((h) => !h)}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-slate-950/50 px-3 py-1 backdrop-blur hover:bg-slate-900"
              >
                {hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                {hidden ? "Hiện câu hỏi" : "Thu câu hỏi"}
              </button>
            )}
          </div>
          <div className="pointer-events-auto mx-auto max-w-4xl">
            <PlayerStrip room={room} />
          </div>
        </div>
      )}

      <Dialog
        open={leaving}
        title="Rời bàn giữa ván?"
        onClose={() => setLeaving(false)}
        actions={
          <>
            <Button variant="outline" onClick={() => setLeaving(false)}>
              Ở lại
            </Button>
            <Button variant="danger" onClick={exit} loading={leave.isPending}>
              Rời bàn
            </Button>
          </>
        }
      >
        Rời bàn lúc đang chơi coi như bị loại. Các câu bạn đã làm vẫn được tính XP.
      </Dialog>
    </div>
  );
}
