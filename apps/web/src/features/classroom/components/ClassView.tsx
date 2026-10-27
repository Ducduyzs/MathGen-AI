"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, LogOut, Plus, Trash2, Trophy, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/layout/States";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth";
import { errorMessage } from "@/lib/api/errors";
import { cn, timeAgo } from "@/lib/utils";
import type { ClassDetail, ClassMember } from "@/types/api";
import { useClass, useClassAssignments, useDeleteClass, useRemoveMember } from "../api";
import { AssignmentForm } from "./AssignmentForm";
import { StudentAssignmentRow, TeacherAssignmentRow } from "./AssignmentRows";
import { JoinCode } from "./JoinCode";
import { Leaderboard } from "./Leaderboard";

type Tab = "assignments" | "members" | "leaderboard";

function Assignments({ c, owner }: { c: ClassDetail; owner: boolean }) {
  const { data, isPending, isError, error, refetch } = useClassAssignments(c.id);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {owner && !creating && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Giao bài mới
          </Button>
        </div>
      )}
      {creating && <AssignmentForm classId={c.id} onDone={() => setCreating(false)} />}
      {isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : !data.length ? (
        !creating && (
          <EmptyState
            icon={ClipboardList}
            title="Chưa có bài nào được giao"
            description={owner ? "Giao bài ôn luyện hoặc đề thi thử THPT, đặt hạn nộp và theo dõi kết quả từng học sinh." : "Giáo viên chưa giao bài cho lớp."}
            action={owner && <Button onClick={() => setCreating(true)}>Giao bài đầu tiên</Button>}
          />
        )
      ) : (
        <Card className="px-5 py-1.5">
          <ul className="divide-y divide-line">
            {data.map((a) => (owner ? <TeacherAssignmentRow key={a.id} a={a} /> : <StudentAssignmentRow key={a.id} a={a} />))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Members({ c }: { c: ClassDetail }) {
  const remove = useRemoveMember();
  const [target, setTarget] = useState<ClassMember | null>(null);
  const members = c.members ?? [];

  if (!members.length) {
    return (
      <EmptyState
        icon={Users}
        title="Lớp chưa có học sinh"
        description="Học sinh đăng nhập, chọn Lớp học → Vào lớp và nhập mã bên dưới."
        action={c.join_code && <JoinCode classId={c.id} code={c.join_code} />}
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-surface text-xs text-muted uppercase">
            <tr>
              <th className="px-5 py-2.5 font-semibold">#</th>
              <th className="px-3 py-2.5 font-semibold">Học sinh</th>
              <th className="px-3 py-2.5 font-semibold">Vào lớp</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m, i) => (
              <tr key={m.id}>
                <td className="px-5 py-3 text-muted tabular-nums">{i + 1}</td>
                <td className="px-3 py-3">
                  <span className="block font-medium text-ink">{m.full_name}</span>
                  <span className="text-xs text-muted">
                    {m.email}
                    {m.grade ? ` · Lớp ${m.grade}` : ""}
                  </span>
                </td>
                <td className="px-3 py-3 text-muted">{timeAgo(m.joined_at)}</td>
                <td className="px-5 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setTarget(m)} aria-label={`Xóa ${m.full_name} khỏi lớp`}>
                    <UserMinus className="size-4" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={!!target}
        title={`Xóa ${target?.full_name ?? ""} khỏi lớp?`}
        onClose={() => setTarget(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                target &&
                remove.mutate(
                  { classId: c.id, userId: target.id },
                  { onSuccess: () => setTarget(null), onError: (err) => toast.error(errorMessage(err)) },
                )
              }
            >
              Xóa khỏi lớp
            </Button>
          </>
        }
      >
        Bài học sinh đã làm vẫn còn trong lịch sử của học sinh, nhưng không hiện trong báo cáo của lớp nữa.
      </Dialog>
    </Card>
  );
}

export function ClassView({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: c, isPending, isError, error, refetch } = useClass(id);
  const remove = useRemoveMember();
  const del = useDeleteClass();
  const [tab, setTab] = useState<Tab>("assignments");
  const [confirming, setConfirming] = useState(false);

  if (isPending) return <Skeleton className="h-72 rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const owner = c.join_code !== undefined;
  const back = owner ? "/teacher/classes" : "/classes";
  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "assignments", label: `Bài tập (${c.assignment_count})`, icon: ClipboardList },
    ...(owner ? [{ key: "members" as const, label: `Học sinh (${c.member_count})`, icon: Users }] : []),
    { key: "leaderboard", label: "Xếp hạng", icon: Trophy },
  ];

  function leaveOrDelete() {
    setConfirming(false);
    const done = { onSuccess: () => router.push(back), onError: (err: unknown) => toast.error(errorMessage(err)) };
    if (owner) del.mutate(c!.id, done);
    else if (user) remove.mutate({ classId: c!.id, userId: user.id }, done);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={back} className="text-sm text-muted hover:text-brand-700">
          ← Lớp học
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{c.name}</h1>
            <p className="mt-1 text-muted">
              {c.grade ? `Khối ${c.grade} · ` : ""}
              {owner ? `${c.member_count} học sinh` : `Giáo viên: ${c.teacher_name} · ${c.member_count} học sinh`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            {owner ? <Trash2 className="size-4" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
            {owner ? "Xóa lớp" : "Rời lớp"}
          </Button>
        </div>
      </div>

      {owner && c.join_code && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <div className="mr-auto">
            <CardTitle>Mã vào lớp</CardTitle>
            <p className="text-sm text-muted">Học sinh chọn Lớp học → Vào lớp và nhập mã này.</p>
          </div>
          <JoinCode classId={c.id} code={c.join_code} />
        </Card>
      )}

      <div role="tablist" aria-label="Nội dung lớp" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <t.icon className="size-4" aria-hidden /> {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "assignments" && <Assignments c={c} owner={owner} />}
        {tab === "members" && owner && <Members c={c} />}
        {tab === "leaderboard" && <Leaderboard classId={c.id} />}
      </div>

      <Dialog
        open={confirming}
        title={owner ? `Xóa lớp ${c.name}?` : `Rời lớp ${c.name}?`}
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={leaveOrDelete} loading={del.isPending || remove.isPending}>
              {owner ? "Xóa lớp" : "Rời lớp"}
            </Button>
          </>
        }
      >
        {owner
          ? "Danh sách học sinh, bài đã giao và báo cáo của lớp sẽ bị xóa. Bài học sinh đã làm vẫn còn trong lịch sử của các em."
          : "Bạn sẽ không thấy bài tập của lớp nữa. Muốn vào lại cần mã lớp từ giáo viên."}
      </Dialog>
    </div>
  );
}
