import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { FILE_TOO_LARGE, MAX_FILE_BYTES } from "@lhhp/shared";
import type { AppEnv } from "./types";
import { defaultDeps, type Deps } from "./deps";
import { jsonError } from "./lib/errors";
import { errorFields, log, setLogLevel } from "./lib/log";
import { authRoutes } from "./routes/auth";
import { mediaRoutes } from "./routes/media";
import { publicRoutes } from "./routes/public";
import { studentRoutes } from "./routes/student";
import { teacherRoutes } from "./routes/teacher";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const IMAGE_ROUTE = /\/(avatar|cover|photos)$/;
const FILE_ROUTE = /^\/api\/t\/students\/\d+\/files$/;

function sameOrigin(origin: string, requestUrl: string, siteUrl: string): boolean {
  try {
    const o = new URL(origin);
    return o.host === new URL(requestUrl).host || o.origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

export function createApp(overrides: Partial<Deps> = {}) {
  const deps: Deps = { ...defaultDeps, ...overrides };
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    setLogLevel(c.env.LOG_LEVEL ?? (c.env.ENVIRONMENT === "test" ? "silent" : "info"));
    const reqId = crypto.randomUUID();
    c.set("reqId", reqId);
    c.set("deps", deps);
    const start = Date.now();
    await next();
    c.res.headers.set("x-request-id", reqId);
    c.res.headers.set("x-content-type-options", "nosniff");
    if (c.req.path.startsWith("/api/")) {
      log(c.res.status >= 500 ? "error" : "info", "request", {
        reqId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Date.now() - start,
      });
    }
  });

  // CSRF: the session cookie is SameSite=Lax, mutations must be JSON (a cross-site form can't send that without a
  // CORS preflight) and, when the browser says where it came from, same-origin.
  app.use("/api/*", async (c, next) => {
    if (MUTATING.has(c.req.method)) {
      const origin = c.req.header("origin");
      if (origin && !sameOrigin(origin, c.req.url, c.env.SITE_URL)) {
        return jsonError(c, 403, "cross_origin", "Yêu cầu không hợp lệ.");
      }
      const mediaType = (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      // A file for a child's page is sent as raw bytes. That is no simple-request type either, so the same holds.
      const allowed = FILE_ROUTE.test(c.req.path) ? "application/octet-stream" : "application/json";
      if (c.req.method !== "DELETE" && mediaType !== allowed) {
        return jsonError(c, 415, "unsupported_media_type", "Dữ liệu gửi lên không hợp lệ.");
      }
    }
    await next();
  });

  // Photos arrive as base64 JSON, already resized in the browser. Everything else is small.
  const smallBody = bodyLimit({
    maxSize: 128 * 1024,
    onError: (c) => jsonError(c, 413, "too_large", "Dữ liệu gửi lên quá lớn."),
  });
  const imageBody = bodyLimit({
    maxSize: 700 * 1024,
    onError: (c) => jsonError(c, 413, "too_large", "Ảnh quá lớn. Hãy chọn ảnh khác."),
  });
  // A Word or Excel file for a child's Măng non page arrives as it is, raw, so no JSON parse spends the CPU budget.
  const fileBody = bodyLimit({
    maxSize: MAX_FILE_BYTES,
    onError: (c) => jsonError(c, 413, "too_large", FILE_TOO_LARGE),
  });
  app.use("/api/*", (c, next) =>
    FILE_ROUTE.test(c.req.path) ? fileBody(c, next) : IMAGE_ROUTE.test(c.req.path) ? imageBody(c, next) : smallBody(c, next),
  );

  app.route("/api", publicRoutes);
  app.route("/api/auth", authRoutes);
  app.route("/api/media", mediaRoutes);
  app.route("/api/t", teacherRoutes);
  app.route("/api/s", studentRoutes);

  app.all("/api/*", (c) => jsonError(c, 404, "not_found", "Không có địa chỉ này."));

  // Everything else is the static site. In production, assets are served before the Worker runs.
  app.all("*", (c) => (c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.text("Not found", 404)));

  app.onError((err, c) => {
    log("error", "unhandled_error", { reqId: c.get("reqId"), path: c.req.path, ...errorFields(err) });
    return jsonError(c, 500, "internal", "Có lỗi xảy ra. Thử lại sau ít phút nhé.");
  });

  return app;
}
