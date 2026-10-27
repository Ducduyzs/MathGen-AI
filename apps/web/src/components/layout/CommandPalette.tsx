"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, CornerDownLeft, FileStack, GraduationCap, Library, Orbit, Search, Sparkles, Swords, Target, Users } from "lucide-react";
import { useAuth } from "@/features/auth";
import { dueLabel, isOpen, useClasses, useMyAssignments } from "@/features/classroom";
import { useSkills } from "@/features/exams";
import { useProblemSets } from "@/features/problem-sets";
import { cn, isTyping } from "@/lib/utils";
import type { Role } from "@/types/api";
import { sectionsFor } from "./nav";

interface Entry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  href: string;
  /** Từ khóa thêm để tìm (không hiện ra). */
  keywords?: string;
}

/** Bỏ dấu tiếng Việt để gõ "ham so" cũng ra "Hàm số". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const PER_GROUP = 6;

// Lối tắt hay dùng ngoài menu
const ACTIONS: Partial<Record<Role, Omit<Entry, "group">[]>> = {
  student: [
    { id: "a:thpt", label: "Làm đề thi tốt nghiệp THPT", icon: GraduationCap, href: "/exams", keywords: "de thi thpt quoc gia" },
    { id: "a:arena", label: "Vào Đấu trường", hint: "5 · 15 · 30 phút", icon: Swords, href: "/arena", keywords: "thi dau xep hang" },
    { id: "a:table", label: "Bàn tròn vũ trụ", hint: "4 người · 3D", icon: Orbit, href: "/arena/table", keywords: "ho den choi cung ban 3d game" },
    { id: "a:daily", label: "Luyện tập theo hồ sơ năng lực", icon: Sparkles, href: "/practice", keywords: "lam bai goi y" },
  ],
  teacher: [{ id: "a:set", label: "Soạn bộ đề mới", icon: FileStack, href: "/teacher/problem-sets", keywords: "tao de kiem tra" }],
};

function useEntries(open: boolean): Entry[] {
  const { user } = useAuth();
  const role = user?.role;
  const student = role === "student";
  const teaches = role === "teacher" || role === "admin";
  const skills = useSkills(open && (student || teaches));
  const classes = useClasses(open && (student || teaches));
  const assignments = useMyAssignments(open && student);
  const sets = useProblemSets(open && teaches);

  return useMemo(() => {
    if (!role) return [];
    const out: Entry[] = [];
    for (const section of sectionsFor(role)) {
      for (const item of section.items) {
        if (!item.soon) out.push({ id: `p:${item.href}`, group: "Trang", label: item.label, icon: item.icon, href: item.href });
      }
    }
    for (const a of ACTIONS[role] ?? []) out.push({ ...a, group: "Lối tắt" });
    for (const a of (assignments.data ?? []).filter((x) => isOpen(x.status))) {
      out.push({
        id: `as:${a.id}`,
        group: "Bài tập lớp",
        label: a.title,
        hint: `${a.class_name}${a.due_at ? ` · ${dueLabel(a.due_at)}` : ""}`,
        icon: ClipboardList,
        href: `/classes/${a.class_id}`,
      });
    }
    for (const s of skills.data ?? []) {
      out.push(
        student
          ? { id: `sk:${s.code}`, group: "Kỹ năng", label: `Luyện ${s.name}`, icon: Target, href: `/practice?skill=${encodeURIComponent(s.code)}`, keywords: s.name }
          : { id: `sk:${s.code}`, group: "Kỹ năng", label: s.name, hint: "Xem bài trong ngân hàng", icon: Library, href: `/problems?skill=${encodeURIComponent(s.code)}` },
      );
    }
    for (const c of classes.data ?? []) {
      out.push({
        id: `c:${c.id}`,
        group: "Lớp học",
        label: c.name,
        hint: student ? c.teacher_name : `${c.member_count} học sinh`,
        icon: Users,
        href: student ? `/classes/${c.id}` : `/teacher/classes/${c.id}`,
      });
    }
    for (const s of sets.data ?? []) {
      out.push({ id: `s:${s.id}`, group: "Bộ đề", label: s.title, hint: `${s.size} câu`, icon: FileStack, href: `/teacher/problem-sets/${s.id}` });
    }
    return out;
  }, [role, student, assignments.data, skills.data, classes.data, sets.data]);
}

function search(entries: Entry[], query: string): Entry[] {
  const q = fold(query.trim());
  if (!q) return entries.filter((e) => e.group === "Trang" || e.group === "Lối tắt" || e.group === "Bài tập lớp");
  const tokens = q.split(/\s+/);
  const scored = entries
    .map((e) => {
      const label = fold(e.label);
      const hay = `${label} ${fold(e.hint ?? "")} ${fold(e.keywords ?? "")}`;
      if (!tokens.every((t) => hay.includes(t))) return null;
      return { e, score: label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2 };
    })
    .filter((x): x is { e: Entry; score: number } => x !== null);
  // Giữ thứ tự nhóm như danh sách gốc, trong nhóm xếp theo độ khớp
  const groups = [...new Set(entries.map((e) => e.group))];
  return groups.flatMap((g) =>
    scored
      .filter((x) => x.e.group === g)
      .sort((a, b) => a.score - b.score)
      .slice(0, PER_GROUP)
      .map((x) => x.e),
  );
}

/** Nút tìm kiếm trên thanh trên cùng + bảng tìm nhanh (Ctrl/⌘ K hoặc phím /). */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mac, setMac] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const entries = useEntries(open);

  const results = useMemo(() => {
    const found = search(entries, query);
    const q = query.trim();
    if (q) {
      found.push({ id: "bank", group: "Ngân hàng bài", label: `Tìm “${q}” trong ngân hàng bài`, icon: Search, href: `/problems?q=${encodeURIComponent(q)}` });
    }
    return found;
  }, [entries, query]);

  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !isTyping(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    router.push(entry.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const shortcut = mac ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Tìm kiếm"
        title={`Tìm kiếm (${shortcut})`}
        className="flex h-9 items-center gap-2 rounded-lg text-sm text-muted hover:bg-brand-50 max-md:w-9 max-md:justify-center md:w-56 md:border md:border-line md:bg-surface md:px-3 md:hover:border-brand-300 md:hover:bg-white lg:w-64"
      >
        <Search className="size-4.5 shrink-0 max-md:text-ink" aria-hidden />
        <span className="hidden min-w-0 flex-1 truncate text-left md:block">Tìm kiếm nhanh…</span>
        <kbd className="hidden rounded border border-line bg-white px-1.5 py-0.5 font-sans text-[11px] text-muted md:block">{shortcut}</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Tìm kiếm" className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 shrink-0 text-muted" aria-hidden />
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Gõ tên trang, kỹ năng, lớp, bộ đề… (không cần dấu)"
                className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/70"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-results"
                aria-activedescendant={results[active] ? `palette-${active}` : undefined}
              />
              <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
            </div>
            <ul ref={list} id="palette-results" role="listbox" className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
              {results.map((r, i) => {
                const Icon = r.icon;
                const first = i === 0 || results[i - 1].group !== r.group;
                return (
                  <li key={r.id} role="presentation">
                    {first && <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{r.group}</p>}
                    <div
                      id={`palette-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2", i === active ? "bg-brand-50 text-brand-800" : "text-ink")}
                    >
                      <Icon className={cn("size-4.5 shrink-0", i === active ? "text-brand-600" : "text-muted")} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.label}</span>
                      {r.hint && <span className="hidden shrink-0 truncate text-xs text-muted sm:block">{r.hint}</span>}
                      {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-brand-600" aria-hidden />}
                    </div>
                  </li>
                );
              })}
              {!results.length && <li className="px-3 py-8 text-center text-sm text-muted">Không tìm thấy kết quả</li>}
            </ul>
            <div className="flex gap-4 border-t border-line bg-surface px-4 py-2 text-[11px] text-muted max-sm:hidden">
              <span>↑↓ để chọn</span>
              <span>Enter để mở</span>
              <span>Esc để đóng</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
