import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { MAX_FILES_PER_STUDENT, MAX_FILE_BYTES, MAX_FILE_BYTES_PER_CLASS } from "@lhhp/shared";
import { addStudents, classroom, client, json, makeClass, signIn, teacher, type Client } from "./helpers";

/**
 * "Tệp hồ sơ" (brief 5, item 2): "Ở phần hồ sơ măng non, thêm tên học sinh cho thêm mục tải tệp lên
 * (doc,docx,xlsx…) để đầy đủ thông tin."
 *
 * These are the teacher's records about a child — a filled-in form can hold the parents' phone numbers — so unlike
 * "Sản phẩm của em" they are hers alone: not the child's account, not a classmate's, not another teacher's.
 */

interface StudentFile {
  id: number;
  name: string;
  size: number;
  url: string;
  createdAt: string;
}

/** Enough of a .docx for the signature check: a zip starts "PK\x03\x04". */
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x00, 0x00, 0x21, 0x00, 0x61, 0x62]);
/** An old .doc / .xls: the OLE compound-file signature. */
const DOC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj");

/** The way the page sends a file: its bytes as they are, its name in the address. */
const upload = (t: Client, sid: number, name: string, bytes: Uint8Array, type = "application/octet-stream") =>
  t.call(`/api/t/students/${sid}/files?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "content-type": type },
    body: bytes,
  });

describe("tệp hồ sơ", () => {
  it("she uploads a Word file to a child's page and downloads it again, byte for byte, under its own name", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    const f = await json<StudentFile>(await upload(t, sid, "Phiếu thông tin An.docx", DOCX), 201);
    expect(f).toMatchObject({ name: "Phiếu thông tin An.docx", size: 16 });
    expect(f.url).toBe(`/api/t/files/${f.id}`);

    const list = await json<StudentFile[]>(await t.get(`/api/t/students/${sid}/files`), 200);
    expect(list.map((x) => x.id)).toEqual([f.id]);

    const res = await t.get(f.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="Phieu thong tin An.docx"; filename*=UTF-8''${encodeURIComponent("Phiếu thông tin An.docx")}`,
    );
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(DOCX);
  });

  it("takes Excel, PDF and the old .doc too, and names the type from the extension, not from what the browser said", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    const xlsx = await json<StudentFile>(await upload(t, sid, "diem.xlsx", DOCX), 201);
    const pdf = await json<StudentFile>(await upload(t, sid, "giay-khai-sinh.PDF", PDF), 201);
    const doc = await json<StudentFile>(await upload(t, sid, "so-lien-lac.doc", DOC), 201);
    expect((await t.get(xlsx.url)).headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect((await t.get(pdf.url)).headers.get("content-type")).toBe("application/pdf");
    expect((await t.get(doc.url)).headers.get("content-type")).toBe("application/msword");
  });

  it("a file bigger than one database row is stored in parts and comes back whole", async () => {
    const { t, accounts } = await classroom();
    const bytes = new Uint8Array(3 * 1024 * 1024);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    for (let i = 4; i < bytes.length; i++) bytes[i] = (i * 31) % 251;
    const f = await json<StudentFile>(await upload(t, accounts[0]!.id, "lon.docx", bytes), 201);
    expect(f.size).toBe(bytes.length);
    const back = new Uint8Array(await (await t.get(f.url)).arrayBuffer());
    expect(back.length).toBe(bytes.length);
    expect(back.every((b, i) => b === bytes[i])).toBe(true);
  });

  it("refuses a type it does not keep, a file whose contents are not what its name says, and one too big", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    expect((await upload(t, sid, "virus.exe", DOCX)).status).toBe(400);
    expect((await upload(t, sid, "trang.html", new TextEncoder().encode("<html>"))).status).toBe(400);
    expect((await upload(t, sid, "gia.docx", new TextEncoder().encode("not a zip at all"))).status).toBe(400);
    expect((await upload(t, sid, "rong.docx", new Uint8Array())).status).toBe(400);
    expect((await upload(t, sid, "khong-ten", DOCX)).status).toBe(400);
    const tooBig = new Uint8Array(MAX_FILE_BYTES + 1);
    tooBig.set(DOCX);
    expect((await upload(t, sid, "to.docx", tooBig)).status).toBe(413);
    expect(await json<StudentFile[]>(await t.get(`/api/t/students/${sid}/files`), 200)).toEqual([]);
  });

  it("only takes raw bytes from the page itself: JSON, a form post or another site are turned away", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    expect((await upload(t, sid, "a.docx", DOCX, "application/json")).status).toBe(415);
    expect((await upload(t, sid, "a.docx", DOCX, "application/x-www-form-urlencoded")).status).toBe(415);
    const cross = await t.call(`/api/t/students/${sid}/files?name=a.docx`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", origin: "https://ke-la.example" },
      body: DOCX,
    });
    expect(cross.status).toBe(403);
    // And raw bytes go nowhere else: the rest of the API still wants JSON.
    expect((await t.call(`/api/t/students/${sid}/works`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: DOCX })).status).toBe(415);
  });

  it(`stops at ${MAX_FILE_BYTES_PER_CLASS / 1024 / 1024} MB for a whole class, so the free database never fills up`, async () => {
    const { t, cls, accounts } = await classroom();
    // As if the class already held that much, without writing a hundred megabytes in a test.
    await env.DB.prepare("INSERT INTO student_files (class_id, student_id, name, content_type, size) VALUES (?, ?, 'cu.pdf', 'application/pdf', ?)")
      .bind(cls.id, accounts[1]!.id, MAX_FILE_BYTES_PER_CLASS - 8)
      .run();
    const r = await upload(t, accounts[0]!.id, "moi.docx", DOCX);
    expect(r.status).toBe(400);
    expect(await r.text()).toContain("cả lớp");
  });

  it(`keeps at most ${MAX_FILES_PER_STUDENT} files a child`, async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    for (let i = 0; i < MAX_FILES_PER_STUDENT; i++) {
      await json(await upload(t, sid, `tep-${i}.docx`, DOCX), 201);
    }
    const r = await upload(t, sid, "mot-nua.docx", DOCX);
    expect(r.status).toBe(400);
  });

  it("is hers alone: not the child's account, not a classmate's, not another teacher's, not a stranger's", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    const f = await json<StudentFile>(await upload(t, sid, "phieu.docx", DOCX), 201);

    const own = await signIn(accounts[0]!);
    expect((await own.get(f.url)).status).toBe(401);
    expect((await own.get(`/api/t/students/${sid}/files`)).status).toBe(401);
    expect((await upload(own, sid, "x.docx", DOCX)).status).toBe(401);
    expect((await own.del(f.url)).status).toBe(401);
    expect((await client().get(f.url)).status).toBe(401);

    const other = await teacher("cob");
    expect((await other.get(f.url)).status).toBe(404);
    expect((await other.get(`/api/t/students/${sid}/files`)).status).toBe(404);
    expect((await upload(other, sid, "x.docx", DOCX)).status).toBe(404);
    expect((await other.del(f.url)).status).toBe(404);
    const otherClass = await makeClass(other, { name: "Lớp 5A" });
    await addStudents(other, otherClass.id, ["Người Lạ"]);
    expect((await other.get(f.url)).status).toBe(404);

    expect((await t.get(f.url)).status).toBe(200);
  });

  it("she can delete a file, and it is gone", async () => {
    const { t, accounts } = await classroom();
    const sid = accounts[0]!.id;
    const f = await json<StudentFile>(await upload(t, sid, "phieu.docx", DOCX), 201);
    expect((await t.del(f.url)).status).toBe(204);
    expect(await json<StudentFile[]>(await t.get(`/api/t/students/${sid}/files`), 200)).toEqual([]);
    expect((await t.get(f.url)).status).toBe(404);
  });
});
