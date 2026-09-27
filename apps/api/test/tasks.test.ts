import { describe, expect, it } from "vitest";
import type { StudentHome, Task } from "@lhhp/shared";
import { addStudents, classroom, fixedNow, json, makeClass, signIn, teacher } from "./helpers";

const NOW = fixedNow("2026-09-23T03:00:00Z"); // Wednesday 23 September 2026, 10:00 in Vietnam

const homework = {
  subject: "toan",
  title: "Luyện tập phép nhân",
  instructions: "Con làm bài 3 và bài 4 trang 45, viết vào vở ô li.",
};

/**
 * Nhiệm vụ is a noticeboard: "k cần HS trả bài trên web, chỉ hiển thị nội dung GV giao việc" (brief 3, item 2).
 * What matters is that what she writes reaches the family whole, and that nothing can be sent back.
 */
describe("nhiệm vụ", () => {
  it("what the teacher writes is what the family reads", async () => {
    const { t, cls, accounts } = await classroom();
    const task = await json<Task>(await t.post(`/api/t/classes/${cls.id}/tasks`, homework), 201);
    expect(task).toMatchObject({ subject: "toan", status: "published", title: homework.title, instructions: homework.instructions });

    const s = await signIn(accounts[0]!);
    const list = await json<Task[]>(await s.get("/api/s/tasks"), 200);
    // The whole notice is in the row: there is no second screen to open.
    expect(list).toEqual([expect.objectContaining({ title: homework.title, instructions: homework.instructions })]);
  });

  it("needs no subject: 'Bỏ phân môn' (brief 9)", async () => {
    const { t, cls } = await classroom();
    const task = await json<Task>(
      await t.post(`/api/t/classes/${cls.id}/tasks`, { title: "Thứ Năm ngày 24/9/2026", instructions: "Toán: bài 1, 2 trang 46." }),
      201,
    );
    expect(task).toMatchObject({ title: "Thứ Năm ngày 24/9/2026", status: "published" });
  });

  it("has nothing for a child to hand in", async () => {
    const { t, cls, accounts } = await classroom();
    const task = await json<Task>(await t.post(`/api/t/classes/${cls.id}/tasks`, homework), 201);
    const s = await signIn(accounts[0]!);
    expect((await s.post(`/api/s/tasks/${task.id}/submit`, { text: "Con làm xong rồi ạ" })).status).toBe(404);
    expect((await s.get(`/api/s/tasks/${task.id}`)).status).toBe(404);
  });

  it("gives no drops: a notice is not scored", async () => {
    const { t, cls, accounts } = await classroom();
    await t.post(`/api/t/classes/${cls.id}/tasks`, homework);
    const s = await signIn(accounts[0]!);
    expect((await json<StudentHome>(await s.get("/api/s/home"), 200)).profile.student.points).toBe(0);
  });

  it("a due date moves a task off the home screen once the day has passed, Vietnam time", async () => {
    const { t, cls, accounts } = await classroom(NOW);
    await json<Task>(await t.post(`/api/t/classes/${cls.id}/tasks`, { ...homework, dueDate: "2026-09-23" }), 201);

    const onTheDay = await signIn(accounts[0]!, fixedNow("2026-09-23T16:59:00Z"));
    expect((await json<StudentHome>(await onTheDay.get("/api/s/home"), 200)).openTasks.length).toBe(1);

    const after = await signIn(accounts[1]!, fixedNow("2026-09-23T17:00:00Z"));
    expect((await json<StudentHome>(await after.get("/api/s/home"), 200)).openTasks.length).toBe(0);
    // It is still there to read, under "đã hết hạn".
    expect((await json<Task[]>(await after.get("/api/s/tasks"), 200)).length).toBe(1);
  });

  it("keeps a draft from the class until she gives it out", async () => {
    const { t, cls, accounts } = await classroom();
    const draft = await json<Task>(await t.post(`/api/t/classes/${cls.id}/tasks`, { ...homework, status: "draft" }), 201);
    const s = await signIn(accounts[0]!);
    expect(await json<Task[]>(await s.get("/api/s/tasks"), 200)).toEqual([]);
    await json(await t.patch(`/api/t/tasks/${draft.id}`, { status: "published" }), 200);
    expect((await json<Task[]>(await s.get("/api/s/tasks"), 200)).length).toBe(1);
  });

  it("she can rewrite or withdraw a notice she has already given", async () => {
    const { t, cls, accounts } = await classroom();
    const task = await json<Task>(await t.post(`/api/t/classes/${cls.id}/tasks`, homework), 201);
    const fixed = await json<Task>(await t.patch(`/api/t/tasks/${task.id}`, { instructions: "Bài 3 và bài 5 trang 45 nhé các con." }), 200);
    expect(fixed.instructions).toBe("Bài 3 và bài 5 trang 45 nhé các con.");

    const s = await signIn(accounts[0]!);
    expect((await json<Task[]>(await s.get("/api/s/tasks"), 200))[0]!.instructions).toBe("Bài 3 và bài 5 trang 45 nhé các con.");
    expect((await t.del(`/api/t/tasks/${task.id}`)).status).toBe(204);
    expect(await json<Task[]>(await s.get("/api/s/tasks"), 200)).toEqual([]);
  });

  it("keeps another teacher out, and another class's children", async () => {
    const { t, cls } = await classroom();
    const task = await json<Task>(await t.post(`/api/t/classes/${cls.id}/tasks`, homework), 201);
    const other = await teacher("cothu");
    const otherClass = await makeClass(other, { name: "Lớp 4B" });
    const [child] = await addStudents(other, otherClass.id, ["Phạm Gia Huy"]);

    expect((await other.get(`/api/t/tasks/${task.id}`)).status).toBe(404);
    expect((await other.patch(`/api/t/tasks/${task.id}`, { title: "Đổi trộm" })).status).toBe(404);
    expect((await other.del(`/api/t/tasks/${task.id}`)).status).toBe(404);
    expect((await other.get(`/api/t/classes/${cls.id}/tasks`)).status).toBe(404);

    const stranger = await signIn(child!);
    expect(await json<Task[]>(await stranger.get("/api/s/tasks"), 200)).toEqual([]);
  });
});
