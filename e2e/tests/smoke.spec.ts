import { expect, test } from "@playwright/test";
import { watchConsole } from "./helpers";

test("the API is healthy through the edge", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: "ok", environment: "development" });
});

test("the front door offers both ways in", async ({ page }) => {
  const check = watchConsole(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Lớp Học Hạnh Phúc");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lớp Học Hạnh Phúc");
  await page.getByRole("link", { name: /Học sinh và phụ huynh/ }).click();
  await expect(page).toHaveURL(/\/dang-nhap\/$/);
  await expect(page.getByRole("heading", { name: "Vào lớp nào!" })).toBeVisible();
  check();
});

test("pages carry the security headers production sends", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
});

test("unknown pages get the 404 page", async ({ page }) => {
  const res = await page.goto("/khong-co-trang-nay/");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Trang này không có trong vở rồi.")).toBeVisible();
});

test("teacher-only and student-only APIs refuse strangers", async ({ request }) => {
  expect((await request.get("/api/t/classes")).status()).toBe(401);
  expect((await request.get("/api/s/home")).status()).toBe(401);
  expect(await (await request.get("/api/auth/me")).json()).toEqual({ me: null });
});
