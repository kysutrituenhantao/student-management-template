"use client";

import { useEffect, useState } from "react";
import { Pin, Trash2 } from "lucide-react";
import type { Announcement, ClassOverview, Message, Thread } from "@lhhp/shared";
import { Chat } from "@/components/chat";
import { Avatar, Field, Loading, LoadError, TextArea, toast } from "@/components/ui";
import { api, del, post } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export function FamilyTab({ overview, reload: reloadClass }: { overview: ClassOverview; reload(): void }) {
  const classId = overview.class.id;
  const threads = useApi<Thread[]>(`/api/t/classes/${classId}/threads`);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setMessages(null);
    // A slow answer for the family opened before must not show under this family's name.
    let current = true;
    void api<Message[]>(`/api/t/students/${studentId}/messages`).then((r) => {
      if (!current) return;
      if (!r.ok) return toast(r.message, "error");
      setMessages(r.data);
      void threads.reload();
      reloadClass();
    });
    return () => {
      current = false;
    };
    // Opening a thread marks it read; the counts elsewhere follow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const talking = overview.students.find((s) => s.id === studentId);
  const withThread = new Set((threads.data ?? []).map((t) => t.studentId));

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        {/* "Lời nhắn là mục GV liên lạc vs PH, tin nhắn của PH sẽ hiện trong này" (brief 4, item 8). */}
        <h1 className="text-[2rem] font-extrabold">💌 Lời nhắn</h1>
        <p className="-mt-2 text-ink-soft">Nơi cô nhắn tin, trao đổi với phụ huynh. Tin nhắn phụ huynh gửi cô cũng hiện ở đây.</p>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="paper max-h-[560px] overflow-y-auto p-2">
            {threads.error ? (
              <LoadError message={threads.error} onRetry={threads.reload} />
            ) : !threads.data ? (
              <Loading />
            ) : (
              <>
                {threads.data.map((t) => (
                  <button
                    key={t.studentId}
                    type="button"
                    onClick={() => setStudentId(t.studentId)}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left", studentId === t.studentId ? "bg-pink-soft" : "hover:bg-page")}
                  >
                    <Avatar emoji={t.avatarEmoji} url={null} name={t.fullName} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2">
                        <span className="truncate font-semibold">{t.fullName}</span>
                        <span className="shrink-0 text-xs text-ink-soft">{timeAgo(t.lastAt)}</span>
                      </span>
                      <span className="block truncate text-sm text-ink-soft">
                        {t.lastSender === "teacher" ? "Cô: " : ""}
                        {t.lastBody}
                      </span>
                    </span>
                    {t.unread ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-red-pen px-1.5 text-xs font-bold text-white">{t.unread}</span> : null}
                  </button>
                ))}
                <p className="mt-3 px-2 text-sm font-semibold text-ink-soft">Nhắn cho gia đình khác</p>
                <p className="mb-1 px-2 text-xs text-ink-soft">Chọn một bạn để bắt đầu trò chuyện với gia đình.</p>
                {overview.students
                  .filter((s) => !withThread.has(s.id))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStudentId(s.id)}
                      className={cn("flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[0.95rem]", studentId === s.id ? "bg-pink-soft" : "hover:bg-page")}
                    >
                      <span aria-hidden>{s.avatarEmoji}</span> {s.fullName}
                    </button>
                  ))}
              </>
            )}
          </div>
          <div className="paper min-h-[420px] overflow-hidden">
            {!talking ? (
              <div className="grid h-full place-items-center p-8 text-center text-ink-soft">
                <p>Chọn một gia đình bên trái để đọc và trả lời tin nhắn. Gia đình nhắn cho cô từ mục “Nhắn cô” trong tài khoản của con.</p>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <p className="border-b border-line px-4 py-3 font-bold">Gia đình bạn {talking.fullName}</p>
                {!messages ? (
                  <Loading />
                ) : (
                  <Chat
                    messages={messages}
                    mine="teacher"
                    placeholder="Viết lời nhắn cho gia đình…"
                    onSend={async (body) => {
                      const r = await post<Message>(`/api/t/students/${talking.id}/messages`, { body });
                      if (!r.ok) {
                        toast(r.message, "error");
                        return false;
                      }
                      setMessages((m) => [...(m ?? []), r.data]);
                      void threads.reload();
                      return true;
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      <Announcements classId={classId} />
    </div>
  );
}

function Announcements({ classId }: { classId: number }) {
  const { data, error, reload } = useApi<Announcement[]>(`/api/t/classes/${classId}/announcements`);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="grid gap-4">
      <h2 className="text-[1.6rem] font-extrabold">📣 Thông báo cho cả lớp</h2>
      <form
        className="paper grid gap-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await post(`/api/t/classes/${classId}/announcements`, { title, body, pinned });
          setBusy(false);
          if (!r.ok) return toast(r.message, "error");
          setTitle("");
          setBody("");
          setPinned(false);
          toast("Đã đăng thông báo.");
          void reload();
        }}
      >
        <Field label="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Họp phụ huynh đầu năm" />
        <TextArea label="Nội dung" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Thời gian, địa điểm, những gì cần chuẩn bị…" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-[var(--pink-ink)]" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Ghim lên đầu
          </label>
          <button className="btn btn-primary ml-auto" disabled={busy || !title.trim()}>
            Đăng thông báo
          </button>
        </div>
      </form>
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <ul className="grid gap-3">
          {data.map((a) => (
            <li key={a.id} className={cn("paper p-4", a.pinned && "border-gold bg-gold-soft/60")}>
              <div className="flex items-start gap-2">
                <h3 className="flex-1 text-lg font-bold">
                  {a.pinned ? <Pin size={16} className="mr-1 inline text-gold-ink" aria-label="Đã ghim" /> : null}
                  {a.title}
                </h3>
                <span className="text-sm text-ink-soft">{formatDate(a.createdAt)}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm !min-h-[30px] !px-2 text-red-pen"
                  aria-label={`Xoá thông báo ${a.title}`}
                  onClick={async () => {
                    if (!window.confirm(`Xoá thông báo “${a.title}”?`)) return;
                    const r = await del(`/api/t/announcements/${a.id}`);
                    if (!r.ok) return toast(r.message, "error");
                    void reload();
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {a.body ? <p className="mt-1 whitespace-pre-wrap">{a.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
