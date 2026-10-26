import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeSession } from "@/features/practice";

export const metadata: Metadata = { title: "Luyện tập" };

export default function PracticePage() {
  return (
    <Suspense>
      <PracticeSession />
    </Suspense>
  );
}
