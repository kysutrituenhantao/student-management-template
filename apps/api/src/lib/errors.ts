import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodError } from "zod";
import type { ApiErrorBody } from "@lhhp/shared";

export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  const body: ApiErrorBody = { error: fields ? { code, message, fields } : { code, message } };
  return c.json(body, status);
}

/** First message per field path, e.g. { "newPassword": "…", "questions.0.prompt": "…" }. */
export function zodFields(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    out[key] ??= issue.message;
  }
  return out;
}

export const notFound = (c: Context, what = "Không tìm thấy.") => jsonError(c, 404, "not_found", what);
