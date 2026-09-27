import { describe, expect, it } from "vitest";
import type { Post, PostLiker } from "@lhhp/shared";
import { classroom, client, fixedNow, json, makeClass, signIn, teacher } from "./helpers";

/** Brief 13: "khi nhấn vào bài viết có thể xem được HS nào like hay bình luận bài". */

const NOW = fixedNow("2026-09-25T03:00:00Z");

describe("who hearted a tile", () => {
  it("names each child whose family hearted it, first heart first, and forgets one taken back", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Vui Tết Trung thu" }), 201);
    const [an, ngoc, duc] = accounts;
    for (const a of [ngoc!, an!, duc!]) await json(await (await signIn(a, NOW)).post(`/api/s/posts/${post.id}/like`), 200);
    await json(await (await signIn(duc!, NOW)).del(`/api/s/posts/${post.id}/like`), 200);

    const likers = await json<PostLiker[]>(await t.get(`/api/t/posts/${post.id}/likes`), 200);
    expect(likers.map((l) => [l.studentId, l.fullName])).toEqual([
      [ngoc!.id, "Trần Bảo Ngọc"],
      [an!.id, "Nguyễn Văn An"],
    ]);
    expect(likers[0]).toHaveProperty("avatarEmoji");
  });

  it("is hers alone: not a family's, not another teacher's", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const post = await json<Post>(await t.post(`/api/t/classes/${cls.id}/posts`, { kind: "hoat_dong", title: "Trồng cây" }), 201);
    const s = await signIn(accounts[0]!, NOW);
    expect((await s.get(`/api/t/posts/${post.id}/likes`)).status).toBe(401);
    expect((await client().get(`/api/t/posts/${post.id}/likes`)).status).toBe(401);
    const other = await teacher("cob", NOW);
    await makeClass(other, { name: "Lớp 5B" });
    expect((await other.get(`/api/t/posts/${post.id}/likes`)).status).toBe(404);
  });
});
