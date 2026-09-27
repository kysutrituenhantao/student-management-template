export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string; fields?: Record<string, string> };

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Sent as it is, as `application/octet-stream`: a file too big to travel as JSON. */
  raw?: Blob;
  signal?: AbortSignal;
}

export const SIGNED_OUT_EVENT = "lhhp-signed-out";

const NETWORK_MESSAGE = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé.";

/** Same-origin JSON call to the Worker API. Never throws; failures come back as `ok: false`. */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.raw) headers["content-type"] = "application/octet-stream";

  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, status: 0, code: "aborted", message: "Đã huỷ." };
    }
    return { ok: false, status: 0, code: "network", message: NETWORK_MESSAGE };
  }

  if (res.status === 204) return { ok: true, status: 204, data: undefined as T };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      status: res.status,
      code: "bad_response",
      message: `Máy chủ trả lời không như mong đợi (${res.status}). Thử lại sau ít phút nhé.`,
    };
  }

  if (res.ok) return { ok: true, status: res.status, data: json as T };
  // A session that expired mid-use: tell the session layer, which sends the user back to sign in.
  if (res.status === 401 && /^\/api\/(t|s)\//.test(path) && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  const err = (json as { error?: { code?: string; message?: string; fields?: Record<string, string> } }).error ?? {};
  return {
    ok: false,
    status: res.status,
    code: err.code ?? "error",
    message: err.message ?? `Có lỗi (${res.status}).`,
    ...(err.fields ? { fields: err.fields } : {}),
  };
}

export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: "POST", body });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body });
export const del = <T = void>(path: string) => api<T>(path, { method: "DELETE" });
