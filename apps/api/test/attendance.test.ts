import { describe, expect, it } from "vitest";
import type { AttendanceView, StudentAttendance, StudentRow } from "@lhhp/shared";
import { addStudents, classroom, fixedNow, json, makeClass, signIn, student, teacher } from "./helpers";

const NOW = fixedNow("2026-09-23T03:00:00Z"); // Wednesday 23 September 2026, 10:00 in Vietnam

describe("chuyên cần", () => {
  it("gives a drop to every child who came, and only one however often the register is taken", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const [an, ngoc, duc] = accounts;
    const view = await json<AttendanceView>(
      await t.put(`/api/t/classes/${cls.id}/attendance`, {
        marks: [
          { studentId: an!.id, status: "co_mat" },
          { studentId: ngoc!.id, status: "di_muon", note: "Muộn 10 phút" },
          { studentId: duc!.id, status: "co_phep", note: "Con bị sốt" },
        ],
      }),
      200,
    );
    expect(view.day).toBe("2026-09-23");
    expect(view.daysTaken).toBe(1);
    expect(view.counts.map((c) => [c.coMat, c.diMuon, c.coPhep, c.khongPhep])).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
    ]);

    // Taking it again changes nothing about the drops.
    await t.put(`/api/t/classes/${cls.id}/attendance`, { marks: [{ studentId: an!.id, status: "co_mat" }] });
    const students = await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200);
    expect(students.map((s) => s.points)).toEqual([1, 1, 0]);
  });

  it("takes the drop back when a child turns out to have been away", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const id = accounts[0]!.id;
    await t.put(`/api/t/classes/${cls.id}/attendance`, { marks: [{ studentId: id, status: "co_mat" }] });
    expect((await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200))[0]!.points).toBe(1);

    await t.put(`/api/t/classes/${cls.id}/attendance`, { marks: [{ studentId: id, status: "khong_phep" }] });
    const after = await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200);
    expect(after[0]!.points).toBe(0);
    expect(after[0]!.drops).toBe(0);
  });

  it("keeps each day's drop apart, and counts the month", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const id = accounts[0]!.id;
    for (const day of ["2026-09-21", "2026-09-22", "2026-09-23"]) {
      await json(await t.put(`/api/t/classes/${cls.id}/attendance`, { day, marks: [{ studentId: id, status: "co_mat" }] }), 200);
    }
    const students = await json<StudentRow[]>(await t.get(`/api/t/classes/${cls.id}/students`), 200);
    expect(students[0]!.points).toBe(3);

    const month = await json<AttendanceView>(await t.get(`/api/t/classes/${cls.id}/attendance?period=month`), 200);
    expect(month.daysTaken).toBe(3);
    expect(month.counts[0]!.coMat).toBe(3);
    const week = await json<AttendanceView>(await t.get(`/api/t/classes/${cls.id}/attendance?period=week`), 200);
    expect(week.period.startDate).toBe("2026-09-21");
    expect(week.counts[0]!.coMat).toBe(3);
  });

  it("reads back the marks of the day it is asked for", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    await t.put(`/api/t/classes/${cls.id}/attendance`, {
      day: "2026-09-22",
      marks: [{ studentId: accounts[0]!.id, status: "co_phep", note: "Đi khám răng" }],
    });
    const yesterday = await json<AttendanceView>(await t.get(`/api/t/classes/${cls.id}/attendance?day=2026-09-22`), 200);
    expect(yesterday.marks).toEqual([{ studentId: accounts[0]!.id, status: "co_phep", note: "Đi khám răng" }]);
    const today = await json<AttendanceView>(await t.get(`/api/t/classes/${cls.id}/attendance?day=2026-09-23`), 200);
    expect(today.marks).toEqual([]);
  });

  it("will not take a register for a day that has not come", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const res = await t.put(`/api/t/classes/${cls.id}/attendance`, {
      day: "2026-09-24",
      marks: [{ studentId: accounts[0]!.id, status: "co_mat" }],
    });
    expect(res.status).toBe(400);
    expect(await json<{ error: { code: string } }>(res)).toMatchObject({ error: { code: "future_day" } });
  });

  it("shows a family their own child's attendance, and nobody else's", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    await t.put(`/api/t/classes/${cls.id}/attendance`, {
      marks: [
        { studentId: accounts[0]!.id, status: "co_mat" },
        { studentId: accounts[1]!.id, status: "khong_phep" },
      ],
    });
    const s = await signIn(accounts[0]!);
    const mine = await json<StudentAttendance>(await s.get("/api/s/attendance?period=month"), 200);
    expect(mine).toMatchObject({ coMat: 1, diMuon: 0, coPhep: 0, khongPhep: 0, daysTaken: 1 });
    expect(mine.recent).toEqual([{ day: "2026-09-23", status: "co_mat", note: "" }]);
  });

  it("refuses a register from another teacher, or for a child of another class", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    const other = await teacher("cothu", NOW);
    const otherClass = await makeClass(other, { name: "Lớp 4B", usernameSuffix: "4b" });
    const otherKids = await addStudents(other, otherClass.id, ["Phạm Gia Huy"]);

    expect((await other.get(`/api/t/classes/${cls.id}/attendance`)).status).toBe(404);
    expect(
      (await other.put(`/api/t/classes/${cls.id}/attendance`, { marks: [{ studentId: accounts[0]!.id, status: "co_mat" }] })).status,
    ).toBe(404);
    expect(
      (await t.put(`/api/t/classes/${cls.id}/attendance`, { marks: [{ studentId: otherKids[0]!.id, status: "co_mat" }] })).status,
    ).toBe(404);
  });
});
