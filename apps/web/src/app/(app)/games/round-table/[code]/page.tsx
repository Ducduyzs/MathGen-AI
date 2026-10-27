import type { Metadata } from "next";
import { RoomView } from "@/features/round-table";

export const metadata: Metadata = { title: "Bàn tròn vũ trụ" };

export default async function TableRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomView code={code.toUpperCase()} />;
}
