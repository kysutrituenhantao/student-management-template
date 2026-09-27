import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/** Brief 15, 26 September 2026: "Phần thi đua ở bên phía PH và HS hiển thị theo tuần. Ví dụ: Nguyễn mInh Anh 123 giọt nước Tuần này 20 giọt nước". */

test("the family's Thi đua goes by week, each child with the total and this week's drops", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Minh Anh", "Trần Văn Tùng"]);
  const [anh, tung] = accounts;
  await t.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [anh!.id], delta: 20 } });
  await t.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [tung!.id], delta: 5 } });

  const fc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const f = await fc.newPage();
  const check = watchConsole(f);
  await studentLogin(f, anh!);
  await f.goto("/hoc-sinh/?tab=thi-dua");
  await f.getByRole("tab", { name: /Vinh danh/ }).click();

  // By week: last week and next week, and no Tháng.
  await expect(f.getByRole("button", { name: "Tuần trước" })).toBeVisible();
  await expect(f.getByRole("tab", { name: /Tháng/ })).toHaveCount(0);

  // Her own card, and every row of the Top 10, in her words: "123 giọt nước · Tuần này 20 giọt nước".
  await expect(f.getByText(/Anh đứng thứ 1\/2 trong lớp/)).toBeVisible();
  const rows = f.getByRole("list", { name: "Top 10 của lớp" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Nguyễn Minh Anh");
  await expect(rows.nth(0)).toContainText("20 giọt nước");
  await expect(rows.nth(0)).toContainText("Tuần này 20 giọt nước");
  await expect(rows.nth(1)).toContainText("Tuần này 5 giọt nước");

  // Last week this child had nothing: the week changes, the total does not.
  await f.getByRole("button", { name: "Tuần trước" }).click();
  await expect(f.getByText(/chưa có giọt nước nào/)).toBeVisible();
  await expect(f.getByText(/Tổng cộng 20 giọt nước/)).toBeVisible();
  check();
  await tc.close();
  await fc.close();
});
