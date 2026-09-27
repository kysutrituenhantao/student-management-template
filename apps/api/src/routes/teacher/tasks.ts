import { Hono } from "hono";
import { taskInput, taskPatch } from "@lhhp/shared";
import type { AppEnv } from "../../types";
import { idParam, readJson } from "../../lib/body";
import { ownedClass } from "../../lib/classes";
import { notFound } from "../../lib/errors";
import { log } from "../../lib/log";
import { TASK_SELECT, toTask } from "../../lib/tasks";

export const taskRoutes = new Hono<AppEnv>();

async function ownedTask(c: Parameters<typeof ownedClass>[0], tid: number | null) {
  if (tid === null) return null;
  return c.env.DB.prepare(`${TASK_SELECT} JOIN classes c ON c.id = t.class_id WHERE t.id = ? AND c.teacher_id = ?`)
    .bind(tid, c.get("teacher").id)
    .first<Record<string, unknown>>();
}

taskRoutes.get("/classes/:id/tasks", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const { results } = await c.env.DB.prepare(`${TASK_SELECT} WHERE t.class_id = ? ORDER BY t.created_at DESC, t.id DESC`)
    .bind(cls.id)
    .all<Record<string, unknown>>();
  return c.json(results.map(toTask));
});

taskRoutes.post("/classes/:id/tasks", async (c) => {
  const cls = await ownedClass(c, idParam(c.req.param("id")));
  if (!cls) return notFound(c, "Không tìm thấy lớp.");
  const body = await readJson(c, taskInput);
  if (!body.ok) return body.res;
  const t = body.data;
  const now = c.get("deps").now().toISOString();
  // `kind` and `questions` are what the old workbook left behind; every task is now a notice.
  const row = await c.env.DB.prepare(
    `INSERT INTO tasks (class_id, subject, kind, title, instructions, due_date, status, published_at, created_at, updated_at)
     VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(cls.id, t.subject, t.title, t.instructions, t.dueDate, t.status, t.status === "published" ? now : null, now, now)
    .first<Record<string, unknown>>();
  log("info", "task_created", { reqId: c.get("reqId"), classId: cls.id, taskId: Number(row!.id), subject: t.subject });
  return c.json(toTask(row!), 201);
});

taskRoutes.get("/tasks/:tid", async (c) => {
  const task = await ownedTask(c, idParam(c.req.param("tid")));
  if (!task) return notFound(c, "Không tìm thấy nhiệm vụ.");
  return c.json(toTask(task));
});

taskRoutes.patch("/tasks/:tid", async (c) => {
  const task = await ownedTask(c, idParam(c.req.param("tid")));
  if (!task) return notFound(c, "Không tìm thấy nhiệm vụ.");
  const body = await readJson(c, taskPatch);
  if (!body.ok) return body.res;
  const p = body.data;
  const now = c.get("deps").now().toISOString();
  const cols: [string, unknown][] = [];
  if (p.subject !== undefined) cols.push(["subject", p.subject]);
  if (p.title !== undefined) cols.push(["title", p.title]);
  if (p.instructions !== undefined) cols.push(["instructions", p.instructions]);
  if (p.dueDate !== undefined) cols.push(["due_date", p.dueDate]);
  if (p.status !== undefined) {
    cols.push(["status", p.status]);
    if (p.status === "published" && !task.published_at) cols.push(["published_at", now]);
  }
  if (cols.length) {
    await c.env.DB.prepare(`UPDATE tasks SET ${cols.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
      .bind(...cols.map(([, v]) => v), now, task.id)
      .run();
  }
  return c.json(toTask((await ownedTask(c, Number(task.id)))!));
});

taskRoutes.delete("/tasks/:tid", async (c) => {
  const task = await ownedTask(c, idParam(c.req.param("tid")));
  if (!task) return notFound(c, "Không tìm thấy nhiệm vụ.");
  await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(task.id).run();
  return c.body(null, 204);
});
