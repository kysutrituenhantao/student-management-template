import type { Context } from "hono";
import type { z } from "zod";
import { jsonError, zodFields } from "./errors";

type Parsed<T> = { ok: true; data: T } | { ok: false; res: Response };

/** Parse and validate a JSON body; on failure returns the 400 response to send. */
export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<Parsed<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, res: jsonError(c, 400, "invalid_json", "Dữ liệu gửi lên không hợp lệ.") };
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const fields = zodFields(r.error);
    const first = Object.values(fields)[0] ?? "Kiểm tra lại các ô được đánh dấu.";
    return { ok: false, res: jsonError(c, 400, "invalid_input", first, fields) };
  }
  return { ok: true, data: r.data };
}

export function clientIp(c: Context): string | null {
  return c.req.header("cf-connecting-ip") ?? null;
}

/**
 * The key a per-IP limit counts against. An IPv6 home connection owns a whole /64, so counting single addresses would let
 * one household rotate through billions of them.
 */
export function rateKey(ip: string): string {
  return ip.includes(":") ? `${ip.split(":").slice(0, 4).join(":")}::/64` : ip;
}

/** A positive integer route parameter, or null. */
export function idParam(raw: string | undefined): number | null {
  return raw && /^\d{1,12}$/.test(raw) ? Number(raw) : null;
}
