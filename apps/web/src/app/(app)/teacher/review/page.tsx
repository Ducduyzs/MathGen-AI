import type { Metadata } from "next";
import { ReviewQueue } from "@/features/review";

export const metadata: Metadata = { title: "Duyệt bài" };

export default function ReviewPage() {
  return <ReviewQueue />;
}
