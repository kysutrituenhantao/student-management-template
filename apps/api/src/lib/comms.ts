import type { Announcement, Message } from "@lhhp/shared";

type Row = Record<string, unknown>;

export const toMessage = (r: Row): Message => ({
  id: Number(r.id),
  sender: r.sender as Message["sender"],
  body: String(r.body),
  createdAt: String(r.created_at),
  readAt: (r.read_at as string | null) ?? null,
});

export const toAnnouncement = (r: Row): Announcement => ({
  id: Number(r.id),
  title: String(r.title),
  body: String(r.body),
  pinned: Number(r.pinned) === 1,
  createdAt: String(r.created_at),
});
