import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/** Brief 17, 26 September 2026: "Phần Trang chủ của giao diện học sinh. Thể hiện rõ tổng cộng số giọt nước và số giọt nước tuần này". */

test("the child's Trang chủ shows the total and this week's drops, each clearly labelled", async ({ page }) => {
  const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Minh Hoàng"]);
  await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[0]!.id], delta: 12 } });
  await page.request.post("/api/auth/logout", { data: {} });
  await page.setViewportSize({ width: 390, height: 844 });
  const check = watchConsole(page);
  await studentLogin(page, accounts[0]!);

  const total = page.getByRole("group", { name: "Tổng cộng" });
  const week = page.getByRole("group", { name: "Tuần này" });
  await expect(total).toContainText("12");
  await expect(total).toContainText("giọt nước");
  await expect(week).toContainText("12");
  // Both are big enough to read at a glance on a phone, and both are on the first screen.
  for (const tile of [total, week]) {
    const size = await tile.getByTestId("drops").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(28);
    await expect(tile).toBeInViewport();
  }
  check();
});
