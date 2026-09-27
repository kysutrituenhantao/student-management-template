"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui";
import type { Task } from "@lhhp/shared";
import { formatLocalDate, todayLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Nhiệm vụ as a Padlet wall of squares (brief 9), the same for the teacher and the family: no subject — "Bỏ phân môn.
 * K cần hiển thị các phân môn" — and a pastel paper each, chosen from the task so it never changes colour. Since
 * brief 10 each is a sticky note pinned up with a pushpin: "giấy note có đính đinh ghim… dễ thương phù hợp với học sinh".
 *
 * Brief 11: "Dù nhiệm vụ dài hay ngắn, chỉ hiển thị như ô thứ 3, nếu dài quá thì chấm ba chấm, HS và PH có thể chọn vào
 * nhiệm vụ để xem đầy đủ." Every note is the same square; the text is cut to the lines that fit and ends in "…", and
 * tapping the note opens it whole.
 */

const PASTELS = 8;
const PINS = 5;

/** A pushpin, drawn: a round head with a shine, a collar, and the needle's shadow. Its colour is `currentColor`. */
function Pin({ className }: { className: string }) {
  return (
    <svg className={cn("task-pin", className)} viewBox="0 0 30 34" aria-hidden focusable="false">
      <path d="M15 19 L16.2 32 L13.8 32 Z" fill="#8b8f99" />
      <ellipse cx="15" cy="19" rx="7.5" ry="3" fill="currentColor" />
      <ellipse cx="15" cy="18" rx="7.5" ry="3" fill="#000" opacity="0.18" />
      <rect x="11" y="10" width="8" height="8" rx="2" fill="currentColor" />
      <circle cx="15" cy="9.5" r="8.5" fill="currentColor" />
      <circle cx="15" cy="9.5" r="8.5" fill="#000" opacity="0.12" />
      <circle cx="14" cy="8.5" r="7.5" fill="currentColor" />
      <ellipse cx="11.5" cy="6" rx="3" ry="2.2" fill="#fff" opacity="0.7" />
    </svg>
  );
}

/**
 * The task's text, cut to as many whole lines as the note has room for, ending in "…". The room depends on the width
 * of the screen and on how many lines the title took, so it is measured rather than guessed.
 */
function ClampedText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Line-clamp puts the "…" on the last whole line but leaves the box its full height, so the next line would peek
    // out below it: the box is cut to exactly those lines too. It is measured against the note, whose size never
    // depends on the text, so cutting the box never sets off another measurement.
    const note = el.closest(".task-tile") ?? el.parentElement!;
    const fit = () => {
      el.style.maxHeight = "";
      el.style.webkitLineClamp = "unset";
      const line = parseFloat(getComputedStyle(el).lineHeight) || 22;
      const lines = Math.max(1, Math.floor((el.clientHeight + 1) / line));
      el.style.webkitLineClamp = String(lines);
      el.style.maxHeight = `${lines * line}px`;
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(note);
    return () => watch.disconnect();
  }, [text]);
  return (
    <p ref={ref} className="task-body mt-2 text-[1.02rem] leading-snug">
      {text}
    </p>
  );
}

export function TaskGrid({
  tasks,
  label,
  corner,
  footer,
}: {
  tasks: Task[];
  label: string;
  /** Her edit and delete buttons; nothing on the family's side. */
  corner?(t: Task): ReactNode;
  footer?(t: Task): ReactNode;
}) {
  const today = todayLocal();
  const [open, setOpen] = useState<Task | null>(null);
  const due = (t: Task) =>
    t.dueDate ? (
      <span className={cn("rounded-full bg-white/70 px-2.5 py-0.5 font-semibold", t.dueDate < today && "text-red-pen")}>
        Hạn {formatLocalDate(t.dueDate)}
      </span>
    ) : null;
  return (
    <>
      <ul className="task-grid" aria-label={label}>
        {tasks.map((t) => (
          // The note casts the shadow; the paper inside it is cut with a folded corner, which would also cut the pin,
          // so the pin sits on the note rather than on the paper. It hangs straight (brief 12).
          <li key={t.id} className="task-note">
            <Pin className={`pin-${(t.id * 3) % PINS}`} />
            <div className={cn("task-tile", `pastel-${t.id % PASTELS}`)}>
              {/* The whole note is the tap target for reading it; her pencil and bin sit above it. */}
              <button type="button" className="absolute inset-0 z-0 cursor-pointer" aria-label={`Xem đầy đủ: ${t.title}`} onClick={() => setOpen(t)} />
              <div className="pointer-events-none relative flex items-start gap-2">
                <p className="task-title min-w-0 flex-1 text-lg font-extrabold leading-snug">{t.title}</p>
                {corner ? <span className="pointer-events-auto relative z-10 -mr-2 -mt-2 flex shrink-0">{corner(t)}</span> : null}
              </div>
              {t.instructions ? <ClampedText text={t.instructions} /> : <span className="flex-1" />}
              <div className="pointer-events-none relative mt-auto flex flex-wrap items-center gap-2 pt-3 text-sm">
                {due(t)}
                {footer ? footer(t) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ""}>
        {open ? (
          <div className={cn("grid gap-3 rounded-md p-4", `pastel-${open.id % PASTELS}`, "task-read")}>
            {open.dueDate ? <p className="text-sm">{due(open)}</p> : null}
            <p className="whitespace-pre-wrap text-[1.08rem] leading-relaxed">{open.instructions || "Cô chưa ghi thêm nội dung."}</p>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
