import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { AccountSlip, NewAccount } from "@lhhp/shared";
import { client, json, makeClass, teacher } from "./helpers";

/**
 * Brief 6: "Tạo tài khoản và mật khẩu học sinh tự động theo mẫu: tên lót-tên-ngày sinh. Ví dụ: minhanh27; hoaian22;
 * ngocanh01. Mật khẩu: Abc12345".
 */

async function addWithBirthdays(t: Awaited<ReturnType<typeof teacher>>, classId: number, kids: [string, string | null][]) {
  return json<NewAccount[]>(
    await t.post(`/api/t/classes/${classId}/students`, {
      students: kids.map(([fullName, birthday], i) => ({ fullName, birthday, group: (i % 2) + 1 })),
    }),
    201,
  );
}

const login = (username: string, password: string) => {
  const s = client();
  return s.post("/api/auth/student/login", { username, password }).then((res) => ({ s, res }));
};

describe("accounts made from the name and the day of birth", () => {
  it("are her examples, with Abc12345, and the birthday lands in Hồ sơ Măng non", async () => {
    const t = await teacher("cohoa");
    const cls = await makeClass(t);
    const made = await addWithBirthdays(t, cls.id, [
      ["Nguyễn Thị Minh Anh", "2016-03-27"],
      ["Trần Hoài An", "2016-11-22"],
      ["Lê Thị Ngọc Ánh", "2016-05-01"],
    ]);
    expect(made.map((a) => [a.username, a.password])).toEqual([
      ["minhanh27", "Abc12345"],
      ["hoaian22", "Abc12345"],
      ["ngocanh01", "Abc12345"],
    ]);
    const row = await env.DB.prepare("SELECT birthday FROM students WHERE id = ?").bind(made[0]!.id).first<{ birthday: string }>();
    expect(row!.birthday).toBe("2016-03-27");
  });

  it("gives the second child with the same pattern a letter after it, in this class or any other", async () => {
    const t = await teacher("cohoa");
    const cls = await makeClass(t);
    const made = await addWithBirthdays(t, cls.id, [
      ["Nguyễn Thị Minh Anh", "2016-03-27"],
      ["Trần Minh Anh", "2016-04-27"],
    ]);
    expect(made.map((a) => a.username)).toEqual(["minhanh27", "minhanh27b"]);

    const other = await teacher("cob");
    const otherClass = await makeClass(other, { name: "Lớp 4B" });
    const [third] = await addWithBirthdays(other, otherClass.id, [["Phạm Minh Anh", "2015-01-27"]]);
    expect(third!.username).toBe("minhanh27c");
  });

  it("is the name alone for a child whose birthday she hasn't got yet", async () => {
    const t = await teacher("cohoa");
    const cls = await makeClass(t);
    const [a] = await addWithBirthdays(t, cls.id, [["Phạm Gia Hân", null]]);
    expect(a!.username).toBe("giahan");
  });

  it("'Đặt lại mật khẩu' goes back to Abc12345", async () => {
    const t = await teacher("cohoa");
    const cls = await makeClass(t);
    const [a] = await addWithBirthdays(t, cls.id, [["Trần Hoài An", "2016-11-22"]]);
    const r = await json<{ password: string }>(await t.post(`/api/t/students/${a!.id}/reset-password`), 200);
    expect(r.password).toBe("Abc12345");
  });
});

describe("the first sign-in with Abc12345", () => {
  it("opens nothing until the family has chosen its own password; then everything opens", async () => {
    const t = await teacher("cohoa");
    const cls = await makeClass(t);
    const [a] = await addWithBirthdays(t, cls.id, [["Trần Hoài An", "2016-11-22"]]);

    const { s, res } = await login("hoaian22", "Abc12345");
    const body = await json<{ me: { mustChangePassword: boolean } }>(res, 200);
    expect(body.me.mustChangePassword).toBe(true);
    expect((await s.get("/api/s/home")).status).toBe(403);
    expect((await s.get(`/api/media/class/${cls.id}`)).status).toBe(404);

    // Not the shared one again, whatever the case.
    expect((await s.post("/api/auth/password", { currentPassword: "Abc12345", newPassword: "abc12345" })).status).toBe(400);
    const changed = await json<{ me: { mustChangePassword: boolean } }>(
      await s.post("/api/auth/password", { currentPassword: "Abc12345", newPassword: "hoaian-rieng" }),
      200,
    );
    expect(changed.me.mustChangePassword).toBe(false);
    expect((await s.get("/api/s/home")).status).toBe(200);

    // Abc12345 no longer opens it; the teacher reads the new one.
    expect((await login("hoaian22", "Abc12345")).res.status).toBe(401);
    const slips = await json<AccountSlip[]>(await t.get(`/api/t/classes/${cls.id}/accounts`), 200);
    expect(slips.find((x) => x.id === a!.id)).toMatchObject({ password: "hoaian-rieng", chosenByChild: true });
  });

  it("a family on a password it was given before the pattern is not asked to change anything", async () => {
    const t = await teacher("cohoa");
    const cls = await makeClass(t);
    const [a] = await addWithBirthdays(t, cls.id, [["Trần Hoài An", "2016-11-22"]]);
    await env.DB.prepare("UPDATE students SET password = 'k9mp42' WHERE id = ?").bind(a!.id).run();
    const { s, res } = await login("hoaian22", "k9mp42");
    expect((await json<{ me: { mustChangePassword: boolean } }>(res, 200)).me.mustChangePassword).toBe(false);
    expect((await s.get("/api/s/home")).status).toBe(200);
  });
});

describe("Tạo lại tài khoản cả lớp theo mẫu", () => {
  it("moves a class made the old way onto the pattern, keeps everything else, and signs everyone out", async () => {
    const t = await teacher("cohoa");
    const cls = await makeClass(t);
    const made = await addWithBirthdays(t, cls.id, [
      ["Nguyễn Thị Minh Anh", "2016-03-27"],
      ["Trần Hoài An", null],
    ]);
    // As the class was on 24 September: random usernames and passwords, one family already signed in.
    await env.DB.batch([
      env.DB.prepare("UPDATE students SET username = 'anh.k7m4', username_key = 'anhk7m4', password = 'k9mp42', password_chosen = 1 WHERE id = ?").bind(made[0]!.id),
      env.DB.prepare("UPDATE students SET username = 'an.x5hc', username_key = 'anx5hc', password = 'dvhfaf', birthday = '2016-11-22' WHERE id = ?").bind(made[1]!.id),
    ]);
    await t.post("/api/t/classes/" + cls.id + "/points", { studentIds: [made[0]!.id], delta: 7 });
    const { s: before } = await login("anh.k7m4", "k9mp42");
    expect((await before.get("/api/s/home")).status).toBe(200);

    const next = await json<{ id: number; username: string }[]>(await t.post(`/api/t/classes/${cls.id}/accounts/pattern`), 200);
    expect(next.map((n) => n.username)).toEqual(["minhanh27", "hoaian22"]);

    expect((await before.get("/api/s/home")).status).toBe(401);
    expect((await login("anh.k7m4", "k9mp42")).res.status).toBe(401);
    expect((await login("minhanh27", "Abc12345")).res.status).toBe(200);
    const drops = await env.DB.prepare("SELECT COALESCE(SUM(delta), 0) AS n FROM point_events WHERE student_id = ?").bind(made[0]!.id).first<{ n: number }>();
    expect(drops!.n).toBe(7);

    // Run twice, a child keeps the username the first run gave them.
    const again = await json<{ username: string }[]>(await t.post(`/api/t/classes/${cls.id}/accounts/pattern`), 200);
    expect(again.map((n) => n.username)).toEqual(["minhanh27", "hoaian22"]);
  });

  it("is only for that class's teacher", async () => {
    const t = await teacher("cohoa");
    const cls = await makeClass(t);
    const [a] = await addWithBirthdays(t, cls.id, [["Trần Hoài An", "2016-11-22"]]);
    const other = await teacher("cob");
    expect((await other.post(`/api/t/classes/${cls.id}/accounts/pattern`)).status).toBe(404);
    const { s } = await login("hoaian22", "Abc12345");
    expect((await s.post(`/api/t/classes/${cls.id}/accounts/pattern`)).status).toBe(401);
    expect((await client().post(`/api/t/classes/${cls.id}/accounts/pattern`)).status).toBe(401);
    expect(a).toBeTruthy();
  });
});
