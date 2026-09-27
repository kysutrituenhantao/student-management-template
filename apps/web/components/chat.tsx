"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { Message } from "@lhhp/shared";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One thread between the teacher and a family. `mine` is the side of whoever is looking. */
export function Chat({
  messages,
  mine,
  onSend,
  placeholder,
}: {
  messages: Message[];
  mine: "teacher" | "family";
  onSend(body: string): Promise<boolean>;
  placeholder: string;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      {/* A live thread: a screen reader should hear a new message arrive without leaving the box. */}
      <div role="log" aria-label="Cuộc trò chuyện" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? <p className="py-8 text-center text-ink-soft">Chưa có tin nhắn nào.</p> : null}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.sender === mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2",
                m.sender === mine ? "rounded-br-md bg-pink-soft" : "rounded-bl-md border border-line bg-white",
              )}
            >
              <p className="text-xs font-semibold text-ink-soft">{m.sender === "teacher" ? "Cô giáo" : "Gia đình"}</p>
              <p className={cn("whitespace-pre-wrap", m.sender === "teacher" && "font-hand text-[1.05rem] text-red-pen")}>{m.body}</p>
              <p className="mt-0.5 text-right text-[0.7rem] text-ink-soft">{formatDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-line p-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setBusy(true);
          const ok = await onSend(body.trim());
          setBusy(false);
          if (ok) setBody("");
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Tin nhắn</span>
          <textarea
            className="input !min-h-[48px] resize-none"
            rows={2}
            value={body}
            placeholder={placeholder}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // On a phone Enter makes a new line (there is no Shift); with a keyboard, Enter sends and Shift+Enter breaks.
              const touch = window.matchMedia("(pointer: coarse)").matches;
              if (e.key === "Enter" && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </label>
        <button className="btn btn-primary !px-3" disabled={busy || !body.trim()} aria-label="Gửi">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
