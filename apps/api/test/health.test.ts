import { describe, expect, it } from "vitest";
import { client } from "./helpers";

describe("GET /api/health", () => {
  it("reports ok with a working database", async () => {
    const res = await client().get("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "ok", environment: "test" });
  });

  it("answers unknown API routes with a JSON 404", async () => {
    const res = await client().get("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "Không có địa chỉ này." } });
  });

  it("tags every response with a request id and nosniff", async () => {
    const res = await client().get("/api/health");
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("CSRF guard", () => {
  it("refuses a cross-site post", async () => {
    const res = await client().call("/api/auth/student/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ username: "a", password: "b" }),
    });
    expect(res.status).toBe(403);
  });

  it("refuses a form post, which a cross-site page could send without a preflight", async () => {
    const res = await client().call("/api/auth/student/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "username=a&password=b",
    });
    expect(res.status).toBe(415);
  });
});
