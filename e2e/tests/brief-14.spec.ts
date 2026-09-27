import { expect, test } from "@playwright/test";
import { apiClassroom, watchConsole } from "./helpers";

/**
 * Brief 14, 26 September 2026: "Ở phần gọi tên ngẫu nhiên hãy thiết kế lại" — a wheel that turns 3–4 times and
 * slows onto the name, a magic hat tapped for 3–5 s instead of the bow, and a duck race with every child's name on a
 * duck of its own colour, about 5 s, with the winner's name in the middle of the screen.
 */

async function openGames(page: import("@playwright/test").Page, names: string[]) {
  const { classId } = await apiClassroom(page.request, names);
  await page.goto(`/giao-vien/lop/?id=${classId}`);
  await page.getByRole("button", { name: /Gọi ngẫu nhiên/ }).click();
  return page.getByRole("dialog");
}

test("the ways to call a name: the bow is gone, the magic hat is in", async ({ page }) => {
  const check = watchConsole(page);
  const pick = await openGames(page, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  await expect(pick.getByRole("tab")).toHaveText([/Gọi nhanh/, /Vòng quay may mắn/, /Chiếc mũ bí mật/, /Đua vịt/]);
  check();
});

test("1. the wheel turns for five to seven seconds and stops on a name", async ({ page }) => {
  const check = watchConsole(page);
  const pick = await openGames(page, ["Nguyễn Thị Mai", "Trần Văn Tùng", "Lê Bảo An"]);
  await pick.getByRole("tab", { name: /Vòng quay may mắn/ }).click();
  const wheel = pick.getByRole("img", { name: /Vòng quay với 3 bạn/ });
  const chosen = page.getByRole("alertdialog", { name: "Bạn được chọn" });
  const started = Date.now();
  await pick.getByRole("button", { name: /Quay!/ }).click();
  // Still turning after four seconds: three to four turns, slowing down.
  await page.waitForTimeout(4000);
  await expect(chosen).toHaveCount(0);
  // Brief 16: the name opens in a window in the middle of the screen as soon as the wheel stops.
  await expect(chosen.getByText("Bạn may mắn là…")).toBeVisible({ timeout: 5000 });
  const took = Date.now() - started;
  expect(took).toBeGreaterThan(4800);
  expect(took).toBeLessThan(8500);
  // The spin is 3–4 whole turns: the wheel's angle says so.
  const deg = await wheel.evaluate((el) => {
    const m = (el as SVGElement).style.transform.match(/rotate\(([-\d.]+)deg\)/);
    return m ? Number(m[1]) : 0;
  });
  expect(deg).toBeGreaterThanOrEqual(3 * 360);
  expect(deg).toBeLessThan(4 * 360);
  check();
});

test("2. chiếc mũ bí mật: a hand taps the hat for three to five seconds, then the name comes out", async ({ page }) => {
  const check = watchConsole(page);
  const pick = await openGames(page, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  await pick.getByRole("tab", { name: /Chiếc mũ bí mật/ }).click();
  await expect(pick.getByRole("img", { name: /Chiếc mũ ảo thuật/ })).toBeVisible();
  const chosen = page.getByRole("alertdialog", { name: "Bạn được chọn" });
  const started = Date.now();
  await pick.getByRole("button", { name: /Gõ mũ/ }).click();
  // Brief 16: a hand with a magic wand, waving over the hat.
  await expect(pick.locator("[data-wand][data-waving]")).toBeVisible();
  await expect(chosen.getByText(/Từ chiếc mũ bí mật/)).toBeVisible({ timeout: 8000 });
  const took = Date.now() - started;
  expect(took).toBeGreaterThan(2900);
  expect(took).toBeLessThan(7000);
  await expect(pick.locator("[data-wand][data-waving]")).toHaveCount(0);
  await expect(chosen.getByRole("button", { name: /^\+1 💧 cho/ })).toBeVisible();
  check();
});

test("3. the duck race: a named duck each, in many colours, about five seconds, the winner's name in the middle", async ({ page }) => {
  const check = watchConsole(page);
  const names = ["Nguyễn Thị Mai", "Trần Văn Tùng", "Lê Bảo An", "Phạm Gia Hân", "Đỗ Minh Khôi", "Vũ Thu Trang"];
  const pick = await openGames(page, names);
  await pick.getByRole("tab", { name: /Đua vịt/ }).click();

  const ducks = pick.locator("[data-duck]");
  await expect(ducks).toHaveCount(names.length);
  // Each duck carries its child's name, and the ducks are not all one colour.
  for (const n of ["Mai", "Tùng", "An", "Hân", "Khôi", "Trang"]) await expect(ducks.filter({ hasText: new RegExp(`^${n}$`) })).toHaveCount(1);
  const colours = await ducks.evaluateAll((els) => els.map((e) => e.getAttribute("data-colour")));
  expect(new Set(colours).size).toBe(names.length);

  const started = Date.now();
  await pick.getByRole("button", { name: /Bắt đầu đua/ }).click();
  const shout = page.getByRole("alertdialog", { name: "Bạn được chọn" });
  await expect(shout.getByText(/Về nhất/)).toBeVisible({ timeout: 9000 });
  const took = Date.now() - started;
  expect(took).toBeGreaterThan(4500);
  expect(took).toBeLessThan(7000);
  // "Hiện tên giữa màn hình": big, and in the middle of the screen.
  const box = (await shout.getByTestId("winner-name").boundingBox())!;
  const view = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(view.width * 0.1);
  expect(Math.abs(box.y + box.height / 2 - view.height / 2)).toBeLessThan(view.height * 0.2);
  const size = await shout.getByTestId("winner-name").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(40);
  await shout.getByRole("button", { name: /^\+1 💧 cho/ }).click();
  await expect(shout).toBeHidden();
  check();
});
