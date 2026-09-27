import { expect, test, type Page } from "@playwright/test";
import { apiClassroom, watchConsole } from "./helpers";

/**
 * Brief 16, 26 September 2026: the magic hat with "bàn tay cầm gậy ảo thuật… hiệu ứng biến hình", ducks that "chen
 * chúc nhau… rộng khoảng 5 làn (nhưng k chia làn)", and the chosen name "thành 1 cửa sổ mới giữa màn hình, hiển thị
 * ngay sau khi hết hiệu ứng chọn tên".
 */

async function openGames(page: Page, names: string[]) {
  const { classId } = await apiClassroom(page.request, names);
  await page.goto(`/giao-vien/lop/?id=${classId}`);
  await page.getByRole("button", { name: /Gọi ngẫu nhiên/ }).click();
  return page.getByRole("dialog");
}

/** The window is in the middle of the screen, in front of everything. */
async function inTheMiddle(page: Page) {
  const win = page.getByRole("alertdialog", { name: "Bạn được chọn" });
  const box = (await win.locator("[data-window]").boundingBox())!;
  const view = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(view.width * 0.05);
  expect(Math.abs(box.y + box.height / 2 - view.height / 2)).toBeLessThan(view.height * 0.12);
  return win;
}

test("the hat: a wand, not a finger, then a puff of magic, then the window", async ({ page }) => {
  const check = watchConsole(page);
  const pick = await openGames(page, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  await pick.getByRole("tab", { name: /Chiếc mũ bí mật/ }).click();
  await expect(pick.getByText("👇")).toHaveCount(0);
  await expect(pick.locator("[data-wand]")).toBeVisible();
  await pick.getByRole("button", { name: /Gõ mũ/ }).click();
  // The transformation comes before the name.
  await expect(pick.locator("[data-poof]")).toBeVisible({ timeout: 7000 });
  const win = page.getByRole("alertdialog", { name: "Bạn được chọn" });
  await expect(win).toBeVisible({ timeout: 3000 });
  await inTheMiddle(page);
  await win.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(win).toHaveCount(0);
  check();
});

test("the ducks: one open pond about five ducks wide, no lanes, the class crowded together", async ({ page }) => {
  const check = watchConsole(page);
  const names = Array.from({ length: 35 }, (_, i) => `Học Sinh Số ${String.fromCharCode(65 + (i % 26))}${i}`);
  const pick = await openGames(page, names);
  await pick.getByRole("tab", { name: /Đua vịt/ }).click();

  const pond = pick.getByRole("img", { name: /Hồ đua vịt/ });
  await expect(pond).toBeVisible();
  // No lanes to swim in.
  await expect(pick.locator("[data-lane]")).toHaveCount(0);
  const ducks = pond.locator("[data-duck]");
  await expect(ducks).toHaveCount(35);

  // A duck is the bird and the name tag it carries.
  const geo = await ducks.evaluateAll((els) => els.map((e) => (e.firstElementChild as HTMLElement).getBoundingClientRect().toJSON() as DOMRect));
  const pondBox = (await pond.boundingBox())!;
  const duckHeight = geo[0]!.height;
  // "Rộng khoảng 5 làn": the pond is about five ducks deep.
  expect(pondBox.height / duckHeight).toBeGreaterThan(4);
  expect(pondBox.height / duckHeight).toBeLessThan(7.5);
  // "Đứng sát nhau": plenty of ducks touch or overlap a neighbour at the start.
  let touching = 0;
  for (let a = 0; a < geo.length; a++) {
    for (let b = a + 1; b < geo.length; b++) {
      const A = geo[a]!;
      const B = geo[b]!;
      if (A.left < B.right + 2 && B.left < A.right + 2 && A.top < B.bottom + 2 && B.top < A.bottom + 2) touching++;
    }
  }
  expect(touching).toBeGreaterThan(20);

  await pick.getByRole("button", { name: /Bắt đầu đua/ }).click();
  const win = page.getByRole("alertdialog", { name: "Bạn được chọn" });
  await expect(win.getByText(/Về nhất/)).toBeVisible({ timeout: 9000 });
  await inTheMiddle(page);
  check();
});

test("the wheel's name opens in the same window in the middle", async ({ page }) => {
  const check = watchConsole(page);
  const pick = await openGames(page, ["Nguyễn Thị Mai", "Trần Văn Tùng", "Lê Bảo An"]);
  await pick.getByRole("tab", { name: /Vòng quay may mắn/ }).click();
  await pick.getByRole("button", { name: /Quay!/ }).click();
  const win = page.getByRole("alertdialog", { name: "Bạn được chọn" });
  await expect(win).toBeVisible({ timeout: 9000 });
  await inTheMiddle(page);
  // She can take the child off the wheel from the window and spin again.
  await win.getByRole("button", { name: /Bỏ ra và quay tiếp/ }).click();
  await expect(win).toHaveCount(0);
  await expect(pick.getByRole("img", { name: /Vòng quay với 2 bạn/ })).toBeVisible();
  check();
});
