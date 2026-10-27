import type { Metadata } from "next";
import { ArenaRunView } from "@/features/arena";

export const metadata: Metadata = { title: "Đấu trường" };

export default async function ArenaRunPage({ params }: { params: Promise<{ id: string }> }) {
  return <ArenaRunView id={(await params).id} />;
}
