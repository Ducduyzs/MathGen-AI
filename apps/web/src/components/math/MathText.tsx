import { Fragment } from "react";
import { MathRenderer } from "./MathRenderer";

// Tách văn bản theo $$...$$ (khối) và $...$ (cùng dòng). Nhờ nhóm bắt trong regex,
// các phần ở vị trí lẻ sau khi split luôn là công thức.
const TOKEN = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g;

export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        return part.startsWith("$$") ? (
          <MathRenderer key={i} latex={part.slice(2, -2)} display />
        ) : (
          <MathRenderer key={i} latex={part.slice(1, -1)} />
        );
      })}
    </span>
  );
}
