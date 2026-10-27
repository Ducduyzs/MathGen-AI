"use client";

import { ErrorState } from "@/components/layout/States";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { useArenaRun } from "../api";
import { ArenaPlay } from "./ArenaPlay";
import { ArenaResult } from "./ArenaResult";

export function ArenaRunView({ id }: { id: string }) {
  const { data: run, isPending, isError, error, refetch } = useArenaRun(id);
  if (isPending) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-2xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  return run.finished || !run.question ? <ArenaResult run={run} /> : <ArenaPlay run={run} />;
}
