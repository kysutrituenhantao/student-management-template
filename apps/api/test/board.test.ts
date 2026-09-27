import { describe, expect, it } from "vitest";
import type { BoardView, Post, PostComment } from "@lhhp/shared";
import { addStudents, classroom, fixedNow, json, makeClass, signIn, student, teacher } from "./helpers";

// A 1×1 png, the smallest thing decodeImage accepts.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const NOW = fixedNow("2026-09-23T03:00:00Z");

describe("the class board", () => {
  it("starts on this month with the chủ điểm the school year suggests", async () => {
    const { t, cls } = await classroom(NOW);
    const board = await json<BoardView>(await t.get(`/api/t/classes/${cls.id}/board`), 200);
    expect(board.month).toMatchObject({ month: "2026-09", label: "Tháng 9/2026", theme: "Mái trường mến yêu" });
    expect(board.posts).toEqual([]);
  });

  it("keeps the theme the teacher writes, and lets her change it later", async () => {
    const { t, cls } = await classroom(NOW);
    const first = await json<BoardView>(
      await t.put(`/api/t/classes/${cls.id}/board/2026-09`, { theme: "Vui hội trăng rằm", note: "Tuần 3 có rước đèn", emoji: "🏮" }),
      200,
    );
    expect(first.month).toMatchObject({ theme: "Vui hội trăng rằm", note: "Tuần 3 có rước đèn", emoji: "🏮" });
    const again = await json<BoardView>(await t.put(`/api/t/classes/${cls.id}/board/2026-09`, { theme: "Mái trường mến yêu" }), 200);
    expect(again.month).toMatchObject({ theme: "Mái trường mến yêu", note: "" });
  });

  it("puts a tile on the wall, pins it, and pages the board by month", async () => {
    const { t, cls } = await classroom(NOW);
    const post = await json<Post>(
      await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Tiết mục văn nghệ", body: "Cả lớp tập múa.", color: "hong" }),
      201,
    );
    expect(post).toMatchObject({ month: "2026-09", kind: "hoat_dong", color: "hong", pinned: false, likes: 0, comments: 0 });

    await json(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "viec_nha", title: "Ôn bảng nhân 7", dueDate: "2026-09-24", month: "2026-10" }), 201);
    await t.patch(`/api/t/posts/${post.id}`, { pinned: true });

    const september = await json<BoardView>(await t.get(`/api/t/classes/${cls.id}/board?month=2026-09`), 200);
    expect(september.posts.map((p) => p.title)).toEqual(["Tiết mục văn nghệ"]);
    expect(september.posts[0]!.pinned).toBe(true);
    expect(september.months).toContain("2026-10");

    const october = await json<BoardView>(await t.get(`/api/t/classes/${cls.id}/board?month=2026-10`), 200);
    expect(october.posts.map((p) => p.title)).toEqual(["Ôn bảng nhân 7"]);
    expect(october.posts[0]!.dueDate).toBe("2026-09-24");
  });

  it("carries photos as URLs, and counts them", async () => {
    const { t, cls } = await classroom(NOW);
    const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Giờ ra chơi" }), 201);
    const one = await json<{ id: number; url: string }>(await t.post(`/api/t/posts/${post.id}/photos`, { dataUrl: PNG }), 201);
    await json(await t.post(`/api/t/posts/${post.id}/photos`, { dataUrl: PNG }), 201);

    const board = await json<BoardView>(await t.get(`/api/t/classes/${cls.id}/board`), 200);
    expect(board.posts[0]!.photos).toHaveLength(2);
    expect(board.posts[0]!.photos[0]).toMatch(/^\/api\/media\/post\/\d+$/);

    expect((await t.del(`/api/t/posts/${post.id}/photos/${one.id}`)).status).toBe(204);
    const after = await json<BoardView>(await t.get(`/api/t/classes/${cls.id}/board`), 200);
    expect(after.posts[0]!.photos).toHaveLength(1);
  });

  it("shows a family the board, and their heart counts once", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Trồng cây" }), 201);
    const s = await signIn(accounts[0]!, NOW);

    const board = await json<BoardView>(await s.get("/api/s/board"), 200);
    expect(board.posts.map((p) => p.title)).toEqual(["Trồng cây"]);
    expect(board.posts[0]!.likedByMe).toBe(false);

    expect(await json(await s.post(`/api/s/posts/${post.id}/like`), 200)).toEqual({ likes: 1, likedByMe: true });
    expect(await json(await s.post(`/api/s/posts/${post.id}/like`), 200)).toEqual({ likes: 1, likedByMe: true });
    expect(await json(await s.del(`/api/s/posts/${post.id}/like`), 200)).toEqual({ likes: 0, likedByMe: false });
  });

  it("lets a family write back, and take their own words down", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Hội chợ quê" }), 201);
    const s = await signIn(accounts[0]!, NOW);

    const mine = await json<PostComment[]>(await s.post(`/api/s/posts/${post.id}/comments`, { body: "Con thích lắm ạ!" }), 201);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ author: "family", authorName: "Phụ huynh Nguyễn Văn An", mine: true });

    const hers = await json<PostComment[]>(await t.post(`/api/t/posts/${post.id}/comments`, { body: "Cảm ơn phụ huynh ạ." }), 201);
    expect(hers).toHaveLength(2);
    expect(hers[1]).toMatchObject({ author: "teacher", authorName: "Cô Hoa", mine: true });

    const seen = await json<PostComment[]>(await s.get(`/api/s/posts/${post.id}/comments`), 200);
    expect(seen.map((k) => k.mine)).toEqual([true, false]);

    expect((await s.del(`/api/s/posts/${post.id}/comments/${seen[1]!.id}`)).status).toBe(404); // not the family's to delete
    expect((await s.del(`/api/s/posts/${post.id}/comments/${mine[0]!.id}`)).status).toBe(204);

    const board = await json<BoardView>(await t.get(`/api/t/classes/${cls.id}/board`), 200);
    expect(board.posts[0]!.comments).toBe(1);
  });

  it("removes a tile with its photos, hearts and comments", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "loi_nhan", title: "Nhắc nhở" }), 201);
    const s = await signIn(accounts[0]!, NOW);
    await s.post(`/api/s/posts/${post.id}/like`);
    await s.post(`/api/s/posts/${post.id}/comments`, { body: "Dạ vâng ạ." });
    await t.post(`/api/t/posts/${post.id}/photos`, { dataUrl: PNG });

    expect((await t.del(`/api/t/posts/${post.id}`)).status).toBe(204);
    const board = await json<BoardView>(await t.get(`/api/t/classes/${cls.id}/board`), 200);
    expect(board.posts).toEqual([]);
    expect((await s.get(`/api/s/posts/${post.id}/comments`)).status).toBe(404);
  });

  describe("another class never reaches this one's board", () => {
    it("closes the board to a second teacher and to another class's family", async () => {
      const { t, cls, accounts } = await classroom(NOW);
      const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Của lớp 4A" }), 201);

      const other = await teacher("cothu", NOW);
      const otherClass = await makeClass(other, { name: "Lớp 4B", usernameSuffix: "4b" });
      const otherKids = await addStudents(other, otherClass.id, ["Phạm Gia Huy"]);
      const otherFamily = await signIn(otherKids[0]!);

      expect((await other.get(`/api/t/classes/${cls.id}/board`)).status).toBe(404);
      expect((await other.patch(`/api/t/posts/${post.id}`, { title: "Đổi trộm" })).status).toBe(404);
      expect((await other.del(`/api/t/posts/${post.id}`)).status).toBe(404);
      expect((await other.post(`/api/t/posts/${post.id}/photos`, { dataUrl: PNG })).status).toBe(404);
      expect((await other.post(`/api/t/posts/${post.id}/comments`, { body: "Chen ngang" })).status).toBe(404);

      expect((await otherFamily.post(`/api/s/posts/${post.id}/like`)).status).toBe(404);
      expect((await otherFamily.post(`/api/s/posts/${post.id}/comments`, { body: "Chen ngang" })).status).toBe(404);
      expect((await otherFamily.get(`/api/s/posts/${post.id}/comments`)).status).toBe(404);

      const theirBoard = await json<BoardView>(await otherFamily.get("/api/s/board"), 200);
      expect(theirBoard.posts).toEqual([]);

      // Still whole from the inside.
      const family = await signIn(accounts[0]!, NOW);
      expect((await json<BoardView>(await family.get("/api/s/board"), 200)).posts).toHaveLength(1);
    });
  });

  it("refuses a photo that is not an image, and stops at six", async () => {
    const { t, cls } = await classroom(NOW);
    const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Ảnh lớp" }), 201);
    expect((await t.post(`/api/t/posts/${post.id}/photos`, { dataUrl: "data:image/png;base64,bm90YW5pbWFnZQ==" })).status).toBe(400);
    for (let i = 0; i < 6; i++) await json(await t.post(`/api/t/posts/${post.id}/photos`, { dataUrl: PNG }), 201);
    const res = await t.post(`/api/t/posts/${post.id}/photos`, { dataUrl: PNG });
    expect(res.status).toBe(400);
    expect(await json<{ error: { code: string } }>(res)).toMatchObject({ error: { code: "too_many_photos" } });
  });
});

describe("stickers on a tile", () => {
  it("a tile keeps the sticker and the shape she chose", async () => {
    const { t, cls } = await classroom();
    const post = await json<Post>(
      await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Hội chợ xuân", sticker: "🎉", layout: "khung" }),
      201,
    );
    expect(post.sticker).toBe("🎉");
    expect(post.layout).toBe("khung");

    const changed = await json<Post>(await t.patch(`/api/t/posts/${post.id}`, { sticker: "🌈" }), 200);
    expect(changed.sticker).toBe("🌈");
    expect(changed.layout).toBe("khung");

    const board = await json<BoardView>(await t.get(`/api/t/classes/${cls.id}/board`), 200);
    expect(board.posts[0]).toMatchObject({ sticker: "🌈", layout: "khung" });
  });

  it("a tile without a sticker is the pinned paper it always was", async () => {
    const { t, cls } = await classroom();
    const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "loi_nhan", title: "Nhắc nhẹ" }), 201);
    expect(post.sticker).toBe("");
    expect(post.layout).toBe("ghim");
  });

  it("refuses a sticker that is not one of ours, and a shape that is not one of ours", async () => {
    const { t, cls } = await classroom();
    expect((await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "loi_nhan", title: "X", sticker: "💩" })).status).toBe(400);
    expect((await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "loi_nhan", title: "X", layout: "trang-tri" })).status).toBe(400);
  });

  it("renaming a tile leaves its colour, its sticker and its shape alone", async () => {
    const { t, cls } = await classroom();
    const post = await json<Post>(
      await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Cũ", color: "tim", sticker: "🎈", layout: "nhan" }),
      201,
    );
    const renamed = await json<Post>(await t.patch(`/api/t/posts/${post.id}`, { title: "Mới" }), 200);
    expect(renamed).toMatchObject({ title: "Mới", color: "tim", sticker: "🎈", layout: "nhan" });
  });

  it("the family sees the sticker too", async () => {
    const { t, cls, accounts } = await classroom();
    await json(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Ảnh lớp", sticker: "📸" }), 201);
    const s = await signIn(accounts[0]!);
    const board = await json<BoardView>(await s.get("/api/s/board"), 200);
    expect(board.posts[0]!.sticker).toBe("📸");
  });
});
