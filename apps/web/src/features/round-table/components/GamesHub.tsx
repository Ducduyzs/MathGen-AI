import { Gamepad2 } from "lucide-react";
import { TablePromo } from "./TablePromo";

/** Khu Trò chơi: tách khỏi Đấu trường (Đấu trường là làm đề tính rank). */
export function GamesHub() {
  return (
    <div className="space-y-4">
      <TablePromo />
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">
        <Gamepad2 className="size-5 shrink-0" aria-hidden />
        Thêm trò chơi mới sẽ xuất hiện ở đây.
      </div>
    </div>
  );
}
