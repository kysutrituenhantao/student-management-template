import { Hono } from "hono";
import type { AppEnv } from "../types";

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/health", async (c) => {
  let db = "ok";
  try {
    await c.env.DB.prepare("SELECT 1").first();
  } catch {
    db = "error";
  }
  const res = c.json({ ok: db === "ok", db, environment: c.env.ENVIRONMENT }, db === "ok" ? 200 : 503);
  res.headers.set("cache-control", "no-store");
  return res;
});
