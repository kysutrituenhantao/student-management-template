import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { AccountSlip, ClassDetail, Me, PointsResult, Reward, StudentHome, StudentRow, Task } from "@lhhp/shared";
import { addStudents, classroom, client, json, makeClass, signIn, student, teacher } from "./helpers";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("sign-in lockout", () => {
  it("can't be dodged by sending many wrong guesses at once", async () => {
    const { accounts } = await classroom();
    const an = accounts[0]!;
    const guesses = Array.from({ length: 20 }, () => client().post("/api/auth/student/login", { username: an.username, password: "wrong" }));
    const statuses = (await Promise.all(guesses)).map((r) => r.status);
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(8);
    const right = await client().post("/api/auth/student/login", { username: an.username, password: an.password });
    expect(right.status).toBe(429);
  });

  it("also guards the current password on the change-password form", async () => {
    const { accounts } = await classroom();
    const s = await student(accounts[0]!, "meo-con-123");
    for (let i = 0; i < 8; i++) await s.post("/api/auth/password", { currentPassword: "sai-roi", newPassword: "meo-moi-456" });
    const res = await s.post("/api/auth/password", { currentPassword: "meo-con-123", newPassword: "meo-moi-456" });
    expect(res.status).toBe(429);
  });
});

describe("the accounts the teacher hands out", () => {
  it("gives every child the class's first password, which the teacher can read back", async () => {
    const t = await teacher();
    const cls = await makeClass(t);
    const [an, ngoc] = await addStudents(t, cls.id, ["Nguyễn Văn An", "Trần Bảo Ngọc"], [1, 2]);

    // Brief 6: "tên lót-tên-ngày sinh" and "Mật khẩu: Abc12345". Being guessable is why it opens nothing until the
    // family has chosen its own — see accounts-pattern.test.ts.
    expect(an!.username).toBe("vanan");
    expect(ngoc!.username).toBe("baongoc");
    expect(an!.password).toBe("Abc12345");
    expect(an!.group).toBe(1);

    // The password works, and a wrong one does not.
    expect((await client().post("/api/auth/student/login", { username: an!.username, password: "abcd1234" })).status).toBe(401);
    expect((await client().post("/api/auth/student/login", { username: an!.username, password: an!.password })).status).toBe(200);

    // And she can read both back whenever a parent asks.
    const slips = await json<AccountSlip[]>(await t.get(`/api/t/classes/${cls.id}/accounts`), 200);
    expect(slips.map((x) => [x.username, x.password, x.chosenByChild])).toEqual([
      [an!.username, an!.password, false],
      [ngoc!.username, ngoc!.password, false],
    ]);
  });

  it("never gives two children the same account, even two called An", async () => {
    const t = await teacher();
    const cls = await makeClass(t);
    const many = await addStudents(t, cls.id, Array.from({ length: 12 }, () => "Nguyễn Văn An"));
    const names = new Set(many.map((a) => a.username));
    expect(names.size).toBe(12);
    expect(many.slice(0, 3).map((a) => a.username)).toEqual(["vanan", "vananb", "vananc"]);
  });

  it("keeps showing the teacher the password after a child picks their own", async () => {
    const { t, cls, accounts } = await classroom();
    await student(accounts[0]!, "meo-con-123");
    const slips = await json<AccountSlip[]>(await t.get(`/api/t/classes/${cls.id}/accounts`), 200);
    expect(slips[0]).toMatchObject({ password: "meo-con-123", chosenByChild: true });
    expect(slips[1]).toMatchObject({ password: accounts[1]!.password, chosenByChild: false });
    expect((await client().post("/api/auth/student/login", { username: accounts[0]!.username, password: "meo-con-123" })).status).toBe(200);
    expect((await client().post("/api/auth/student/login", { username: accounts[0]!.username, password: accounts[0]!.password })).status).toBe(401);
  });

  it("a reset puts the account back on Abc12345, and the family's own password stops working", async () => {
    const { t, accounts } = await classroom();
    const an = accounts[0]!;
    await student(an, "meo-con-123");
    const reset = await json<{ username: string; password: string }>(await t.post(`/api/t/students/${an.id}/reset-password`), 200);
    expect(reset.password).toBe("Abc12345");
    expect((await client().post("/api/auth/student/login", { username: an.username, password: "meo-con-123" })).status).toBe(401);
    expect((await client().post("/api/auth/student/login", { username: an.username, password: reset.password })).status).toBe(200);
  });

  it("only this class's teacher sees the list, and no family ever does", async () => {
    const { t, cls, accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    expect((await s.get(`/api/t/classes/${cls.id}/accounts`)).status).toBe(401);

    const other = await teacher("cothu");
    expect((await other.get(`/api/t/classes/${cls.id}/accounts`)).status).toBe(404);

    // Nothing a family loads carries a classmate's password.
    const home = await (await s.get("/api/s/home")).text();
    expect(home).not.toContain(accounts[1]!.password);
    const book = await (await s.get("/api/s/mang-non")).text();
    expect(book).not.toContain(accounts[1]!.password);
  });

  it("the list is never cached by a browser or a proxy", async () => {
    const { t, cls } = await classroom();
    const res = await t.get(`/api/t/classes/${cls.id}/accounts`);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("races", () => {
  it("two rewards handed out together can't spend the same drops", async () => {
    const { t, cls, accounts } = await classroom();
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 20 });
    const sticker = (await json<Reward[]>(await t.get(`/api/t/classes/${cls.id}/rewards`), 200)).find((r) => r.cost === 20)!;
    const results = await Promise.all(
      Array.from({ length: 4 }, () => t.post(`/api/t/classes/${cls.id}/redemptions`, { studentId: accounts[0]!.id, rewardId: sticker.id })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 400, 400, 400]);
  });

  it("two taps together report the level-up exactly once", async () => {
    const { t, cls, accounts } = await classroom();
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 8 });
    const both = await Promise.all([1, 2].map(() => t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 1 })));
    const results = await Promise.all(both.map((r) => r.json() as Promise<PointsResult>));
    expect(results.flatMap((r) => r.levelUps)).toEqual([{ studentId: accounts[0]!.id, fullName: "Nguyễn Văn An", level: 2 }]);
  });
});

describe("the family's home", () => {
  it("hides the child's weekly rank when the teacher hides the Top 10", async () => {
    const { t, cls, accounts } = await classroom();
    await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 3 });
    await t.patch(`/api/t/classes/${cls.id}`, { showLeaderboard: false });
    const s = await signIn(accounts[0]!);
    const home = await json<StudentHome>(await s.get("/api/s/home"), 200);
    expect(home.profile.rank).toBeNull();
    expect(home.weekTop).toBeNull();
  });

  it("shows at most 20 notices on the home screen, the soonest first", async () => {
    const { t, cls, accounts } = await classroom();
    for (let i = 0; i < 25; i++) {
      await json<Task>(await t.post(`/api/t/classes/${cls.id}/tasks`, { subject: "khac", title: `Việc ${i}`, dueDate: "2099-01-01" }), 201);
    }
    const s = await signIn(accounts[0]!);
    const home = await json<StudentHome>(await s.get("/api/s/home"), 200);
    expect(home.openTasks.length).toBe(20);
  });
});

describe("input checks", () => {
  it("wants exactly application/json on a mutation", async () => {
    const res = await client().call("/api/auth/student/login", {
      method: "POST",
      headers: { "content-type": "text/plain; x=application/json" },
      body: JSON.stringify({ username: "a", password: "b" }),
    });
    expect(res.status).toBe(415);
    const ok = await client().call("/api/auth/student/login", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ username: "a", password: "b" }),
    });
    expect(ok.status).toBe(401);
  });

  it("answers a badge key like 'constructor' with 400, not 500", async () => {
    const { t, cls, accounts } = await classroom();
    for (const badgeKey of ["constructor", "__proto__", "toString"]) {
      expect((await t.post(`/api/t/classes/${cls.id}/badges`, { studentIds: [accounts[0]!.id], badgeKey })).status, badgeKey).toBe(400);
    }
  });

  it("refuses image data that doesn't decode", async () => {
    const { accounts } = await classroom();
    const s = await signIn(accounts[0]!);
    for (const dataUrl of ["data:image/png;base64,iVBORw0KG", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA"]) {
      expect((await s.put("/api/s/avatar", { dataUrl })).status, dataUrl).toBe(400);
    }
  });

  it("clamps the history page size", async () => {
    const { t, cls, accounts } = await classroom();
    for (let i = 0; i < 3; i++) await t.post(`/api/t/classes/${cls.id}/points`, { studentIds: [accounts[0]!.id], delta: 1 });
    const page = await json<unknown[]>(await t.get(`/api/t/classes/${cls.id}/points?limit=-1`), 200);
    expect(page.length).toBe(1);
  });

  it("takes a team leader only from the class", async () => {
    const { t, cls } = await classroom();
    const other = await teacher("cob");
    const theirs = await makeClass(other, { name: "Lớp khác" });
    const [stranger] = await addStudents(other, theirs.id, ["Người Lạ"]);
    const teams = cls.teams.map((x, i) => (i === 0 ? { ...x, leaderId: stranger!.id } : x));
    expect((await t.patch(`/api/t/classes/${cls.id}`, { teams })).status).toBe(400);
  });

  it("keeps a semester to a school semester's length", async () => {
    const { t, cls } = await classroom();
    expect((await t.patch(`/api/t/classes/${cls.id}`, { hk1Start: "2016-09-05" })).status).toBe(400);
  });

});
