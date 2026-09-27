import { describe, expect, it } from "vitest";
import type { Announcement, ClassOverview, Message, StudentHome, Thread } from "@lhhp/shared";
import { classroom, json, signIn, student } from "./helpers";

describe("teacher ↔ family messages", () => {
  it("a family writes, the teacher sees it unread, replies, and the family reads it", async () => {
    const { t, cls, accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    await json<Message>(await s.post("/api/s/messages", { body: "Thưa cô, mai con xin nghỉ ốm ạ." }), 201);
    expect((await json<ClassOverview>(await t.get(`/api/t/classes/${cls.id}`), 200)).stats.unreadMessages).toBe(1);
    const threads = await json<Thread[]>(await t.get(`/api/t/classes/${cls.id}/threads`), 200);
    expect(threads).toEqual([expect.objectContaining({ fullName: "Nguyễn Văn An", lastSender: "family", unread: 1 })]);

    const opened = await json<Message[]>(await t.get(`/api/t/students/${accounts[0]!.id}/messages`), 200);
    expect(opened.map((m) => m.sender)).toEqual(["family"]);
    expect((await json<ClassOverview>(await t.get(`/api/t/classes/${cls.id}`), 200)).stats.unreadMessages).toBe(0);

    await json(await t.post(`/api/t/students/${accounts[0]!.id}/messages`, { body: "Cô biết rồi, con nghỉ ngơi nhé." }), 201);
    expect((await json<StudentHome>(await s.get("/api/s/home"), 200)).unreadMessages).toBe(1);
    const mine = await json<Message[]>(await s.get("/api/s/messages"), 200);
    expect(mine.map((m) => m.body)).toEqual(["Thưa cô, mai con xin nghỉ ốm ạ.", "Cô biết rồi, con nghỉ ngơi nhé."]);
    expect((await json<StudentHome>(await s.get("/api/s/home"), 200)).unreadMessages).toBe(0);
  });

  it("a family only ever sees their own child's thread", async () => {
    const { t, accounts } = await classroom();
    await t.post(`/api/t/students/${accounts[1]!.id}/messages`, { body: "Gửi riêng phụ huynh Ngọc" });
    const s = await signIn(accounts[0]!);
    expect(await json<Message[]>(await s.get("/api/s/messages"), 200)).toEqual([]);
  });

  it("refuses an empty message", async () => {
    const { accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    expect((await s.post("/api/s/messages", { body: "   " })).status).toBe(400);
  });
});

describe("announcements", () => {
  it("posted by the teacher, pinned first, seen by the class", async () => {
    const { t, cls, accounts } = await classroom();
    await t.post(`/api/t/classes/${cls.id}/announcements`, { title: "Họp phụ huynh", body: "Thứ bảy 8h." });
    const pinned = await json<Announcement>(await t.post(`/api/t/classes/${cls.id}/announcements`, { title: "Nghỉ lễ", pinned: true }), 201);
    await t.patch(`/api/t/announcements/${pinned.id}`, { title: "Nghỉ lễ 2/9", body: "", pinned: true });
    const s = await signIn(accounts[0]!);
    const list = await json<Announcement[]>(await s.get("/api/s/announcements"), 200);
    expect(list.map((a) => a.title)).toEqual(["Nghỉ lễ 2/9", "Họp phụ huynh"]);
    await t.del(`/api/t/announcements/${pinned.id}`);
    expect((await json<Announcement[]>(await s.get("/api/s/announcements"), 200)).length).toBe(1);
  });
});
