import { describe, expect, it, vi } from "vitest";
import { api, post } from "@/lib/api";

function stubFetch(res: Response | Error) {
  const fn = vi.fn(async () => {
    if (res instanceof Error) throw res;
    return res;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api", () => {
  it("returns data on success and sends JSON same-origin", async () => {
    const fn = stubFetch(new Response(JSON.stringify({ me: null }), { status: 200 }));
    const r = await post("/api/auth/logout", { a: 1 });
    expect(r).toEqual({ ok: true, status: 200, data: { me: null } });
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", body: '{"a":1}' });
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("carries the API's Vietnamese message and field errors on failure", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: { code: "invalid_input", message: "Tên quá ngắn.", fields: { fullName: "Tên quá ngắn." } } }), {
        status: 400,
      }),
    );
    expect(await api("/api/x")).toEqual({
      ok: false,
      status: 400,
      code: "invalid_input",
      message: "Tên quá ngắn.",
      fields: { fullName: "Tên quá ngắn." },
    });
  });

  it("never throws: a network failure becomes a message to show", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    const r = await api("/api/x");
    expect(r).toMatchObject({ ok: false, code: "network" });
  });

  it("treats 204 as success with no body", async () => {
    stubFetch(new Response(null, { status: 204 }));
    expect(await api("/api/x")).toEqual({ ok: true, status: 204, data: undefined });
  });
});
