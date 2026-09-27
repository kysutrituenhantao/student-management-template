import { describe, expect, it } from "vitest";
import { addStudents, classroom, client, json, makeClass, signIn, teacher } from "./helpers";

/**
 * "Sản phẩm của em" (brief 4, item 5): "GV có thể tải bài kiểm tra, sản phẩm HS làm để PH theo dõi
 * (PH k tải đc tài liệu do gv upload mà chỉ xem)".
 *
 * A marked test is about one child. Unlike an avatar or a photo on the board, a classmate has no business seeing
 * it — so these tests pin down who can, which is the teacher of that class and that child's own family.
 */

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

interface Work {
  id: number;
  title: string;
  url: string;
  createdAt: string;
}

describe("sản phẩm của em", () => {
  it("the teacher hangs a piece of work on a child's page and it comes back in the list", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    const work = await json<Work>(await t.post(`/api/t/students/${sid}/works`, { title: "Bài kiểm tra Toán tuần 5", dataUrl: PNG }), 201);
    expect(work.title).toBe("Bài kiểm tra Toán tuần 5");
    expect(work.url).toMatch(/^\/api\/media\/work\/\d+$/);

    const list = await json<Work[]>(await t.get(`/api/t/students/${sid}/works`), 200);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(work.id);
  });

  it("a piece of work may go up with no title — she is uploading thirty-five photos, not writing labels", async () => {
    const { t, accounts } = await classroom();
    const work = await json<Work>(await t.post(`/api/t/students/${accounts[0]!.id}/works`, { dataUrl: PNG }), 201);
    expect(work.title).toBe("");
  });

  it("the newest is first, so what she uploaded this morning is at the top", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    for (const title of ["Tuần 1", "Tuần 2", "Tuần 3"]) {
      await json(await t.post(`/api/t/students/${sid}/works`, { title, dataUrl: PNG }), 201);
    }
    const list = await json<Work[]>(await t.get(`/api/t/students/${sid}/works`), 200);
    expect(list.map((w) => w.title)).toEqual(["Tuần 3", "Tuần 2", "Tuần 1"]);
  });

  it("the child's own account sees their work, under their own name", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    const work = await json<Work>(await t.post(`/api/t/students/${sid}/works`, { title: "Tranh vẽ", dataUrl: PNG }), 201);

    const s = await signIn(accounts[0]!);
    const mine = await json<Work[]>(await s.get("/api/s/works"), 200);
    expect(mine.map((w) => w.id)).toEqual([work.id]);
    expect((await s.get(work.url)).status).toBe(200);
  });

  it("a classmate cannot see it — a marked test belongs to one child", async () => {
    const { t, accounts } = await classroom();
    const work = await json<Work>(await t.post(`/api/t/students/${accounts[0]!.id}/works`, { dataUrl: PNG }), 201);

    const classmate = await signIn(accounts[1]!);
    expect((await classmate.get(work.url)).status).toBe(404);
    expect(await json<Work[]>(await classmate.get("/api/s/works"), 200)).toEqual([]);
  });

  it("nobody outside the class sees it, signed in or not", async () => {
    const { t, accounts } = await classroom();
    const work = await json<Work>(await t.post(`/api/t/students/${accounts[0]!.id}/works`, { dataUrl: PNG }), 201);

    expect((await client().get(work.url)).status).toBe(404);
    const other = await teacher("cob");
    expect((await other.get(work.url)).status).toBe(404);
    const otherClass = await makeClass(other, { name: "Lớp 5A" });
    const [stranger] = await addStudents(other, otherClass.id, ["Người Lạ"]);
    expect((await (await signIn(stranger!)).get(work.url)).status).toBe(404);
  });

  it("another teacher can neither upload to this child nor list what is there", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    await json(await t.post(`/api/t/students/${sid}/works`, { dataUrl: PNG }), 201);
    const other = await teacher("cob");
    expect((await other.post(`/api/t/students/${sid}/works`, { dataUrl: PNG })).status).toBe(404);
    expect((await other.get(`/api/t/students/${sid}/works`)).status).toBe(404);
  });

  it("is served to be looked at, not taken away", async () => {
    const { t, accounts } = await classroom();
    const work = await json<Work>(await t.post(`/api/t/students/${accounts[0]!.id}/works`, { dataUrl: PNG }), 201);
    const res = await t.get(work.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("content-disposition")).toBe("inline");
  });

  it("she can take a piece of work down again; the family cannot", async () => {
    const { t, accounts } = await classroom();
    const work = await json<Work>(await t.post(`/api/t/students/${accounts[0]!.id}/works`, { dataUrl: PNG }), 201);
    const s = await signIn(accounts[0]!);
    expect((await s.del(`/api/t/works/${work.id}`)).status).toBe(401);

    const other = await teacher("cob");
    expect((await other.del(`/api/t/works/${work.id}`)).status).toBe(404);

    expect((await t.del(`/api/t/works/${work.id}`)).status).toBe(204);
    expect(await json<Work[]>(await t.get(`/api/t/students/${accounts[0]!.id}/works`), 200)).toEqual([]);
    expect((await t.get(work.url)).status).toBe(404);
  });

  it("refuses something that is not an image, and a title longer than the box", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    expect((await t.post(`/api/t/students/${sid}/works`, { dataUrl: "data:text/html;base64,PGh0bWw+" })).status).toBe(400);
    expect((await t.post(`/api/t/students/${sid}/works`, { dataUrl: PNG, title: "x".repeat(121) })).status).toBe(400);
  });
});
