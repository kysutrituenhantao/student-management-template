import { expect, test, type Page } from "@playwright/test";
import { apiClassroom, watchConsole } from "./helpers";

/**
 * Her fifth brief, late on 24 September 2026, in chat with a screenshot of the toolbar. One test per item.
 */

const ORDER = [/Trang chủ/, /Bảng tin/, /Nhiệm vụ/, /Hồ sơ Măng non/, /Chuyên cần/, /Sơ đồ lớp/, /Báo cáo/, /Thi đua/, /Đổi thưởng/, /Lời nhắn/];

/** Every button on the bar, where it is on the screen. */
async function toolbar(page: Page) {
  const bar = page.getByRole("tablist", { name: "Thanh công cụ" });
  await expect(bar.getByRole("tab")).toHaveText(ORDER);
  const boxes = await bar.getByRole("tab").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  const width = page.viewportSize()!.width;
  // "Không để thông tin ra khỏi màn hình": every button is whole and on the screen, without scrolling anything.
  for (const b of boxes) {
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(width);
  }
  expect(await bar.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  return boxes;
}

for (const width of [1920, 1440, 1280]) {
  test.describe(`on a ${width}px laptop`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("1. the ten buttons are on one row, and all of them are on the screen", async ({ page }) => {
      const check = watchConsole(page);
      const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
      await page.goto(`/giao-vien/lop/?id=${classId}`);
      const boxes = await toolbar(page);
      // "Dồn thanh công cụ lên 1 hàng".
      expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBe(1);
      check();
    });
  });
}

for (const width of [390, 768, 1024]) {
  test.describe(`on a ${width}px screen`, () => {
    test.use({ viewport: { width, height: 850 } });

    test("1. too narrow for one row: every button still shows, nothing scrolls sideways", async ({ page }) => {
      const check = watchConsole(page);
      const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
      await page.goto(`/giao-vien/lop/?id=${classId}&tab=loi-nhan`);
      const boxes = await toolbar(page);
      for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(44);
      await page.getByRole("tablist", { name: "Thanh công cụ" }).getByRole("tab", { name: /Thi đua/ }).click();
      await expect(page).toHaveURL(/tab=thi-dua/);
      check();
    });
  });
}

/**
 * Item 2 was built, and then she took it back the same evening with a screenshot of the section: "Bỏ mục này". So a
 * child's Măng non page has no file section and no blank form. Files already uploaded stay in the database (brief 8).
 */
test("2, taken back. A child's Măng non page has no Tệp hồ sơ and no blank form", async ({ page }) => {
  const check = watchConsole(page);
  const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=ho-so`);
  await page.getByRole("button", { name: /Sửa trang Măng non của Nguyễn Thị Mai/ }).click();
  const sheet = page.getByRole("dialog");
  // The rest of the page is still there.
  await expect(sheet.getByText("Sản phẩm của em")).toBeVisible();
  await expect(sheet.getByText(/Tệp hồ sơ/)).toHaveCount(0);
  await expect(sheet.getByRole("link", { name: /Tải phiếu mẫu/ })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: /Thêm tệp/ })).toHaveCount(0);
  check();
});
