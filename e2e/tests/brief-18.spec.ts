import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/**
 * Brief 18, 27 September 2026: "Phần thi đua hiển thị kết qủa tuần trước. Ghi tên tuần (tuần 1 từ 7-9 đến 11/9; tuần 2
 * (14/9-18/9) tương tự như thế đến hết tuần 35. Chỉ hiển thị kết quả tuần đc giáo viên nhập. Nếu GV chưa nhập thì k
 * hiển thị".
 */

// A class made for 2026–2027 opens on Saturday 5/9, so Tuần 1 is Monday 7/9.
const WEEK1 = Date.UTC(2026, 8, 7);
const DAY = 86_400_000;
const dm = (ms: number) => new Date(ms).toISOString().slice(8, 10) + "/" + new Date(ms).toISOString().slice(5, 7);
const label = (n: number) => `Tuần ${n} (${dm(WEEK1 + (n - 1) * 7 * DAY)} – ${dm(WEEK1 + (n - 1) * 7 * DAY + 4 * DAY)})`;
/** "Tuần trước": the latest school week that has finished, today in Vietnam. */
function lastWeek(): number {
  const now = new Date(Date.now() + 7 * 3_600_000);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.floor((today - WEEK1) / DAY);
  const weekday = (new Date(today).getUTCDay() + 6) % 7;
  const finished = Math.floor(days / 7) + (weekday >= 5 ? 1 : 0);
  return Math.min(35, Math.max(1, finished));
}

test("her Kết quả thi đua opens on last week, by its school name, and she can pick any of the 35", async ({ page }) => {
  const check = watchConsole(page);
  const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=thi-dua`);

  const weeks = page.getByRole("combobox", { name: "Chọn tuần" });
  await expect(weeks.locator("option")).toHaveCount(35);
  await expect(weeks.locator("option").first()).toHaveText("Tuần 1 (07/09 – 11/09)");
  await expect(weeks.locator("option").nth(1)).toHaveText("Tuần 2 (14/09 – 18/09)");
  await expect(weeks.locator("option:checked")).toHaveText(label(lastWeek()));

  // She enters Tuần 2; the list marks it as entered.
  await weeks.selectOption({ label: "Tuần 2 (14/09 – 18/09)" });
  await page.getByRole("button", { name: /Nhập kết quả/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Tuần 2 (14/09 – 18/09)");
  await sheet.getByLabel("Điểm 1").fill("98");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(sheet).toBeHidden();
  await expect(weeks.locator("option").nth(1)).toHaveText("Tuần 2 (14/09 – 18/09) ✓");
  check();
});

test("families see only the weeks she entered — and no Kết quả thi đua at all until she enters one", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai"]);
  const cls = (await (await t.request.get(`/api/t/classes/${classId}`)).json()) as { class: { name: string } };

  const fc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const f = await fc.newPage();
  const check = watchConsole(f);
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=thi-dua");
  await expect(f.getByRole("tab", { name: /Vinh danh/ })).toBeVisible();
  await expect(f.getByRole("tab", { name: /Kết quả thi đua/ })).toHaveCount(0);

  // She enters Tuần 1 and Tuần 3.
  const rows = [{ name: cls.class.name, score: 97, isOurs: true }, { name: "Lớp 4A", score: 99, isOurs: false }];
  for (const date of ["2026-09-08", "2026-09-22"]) {
    expect((await t.request.put(`/api/t/classes/${classId}/competition`, { data: { period: "week", date, rows } })).status()).toBe(200);
  }

  await f.reload();
  await f.getByRole("tab", { name: /Kết quả thi đua/ }).click();
  const weeks = f.getByRole("combobox", { name: "Chọn tuần" });
  // Only those two, the newest first and open.
  await expect(weeks.locator("option")).toHaveText(["Tuần 3 (21/09 – 25/09)", "Tuần 1 (07/09 – 11/09)"]);
  await expect(weeks.locator("option:checked")).toHaveText("Tuần 3 (21/09 – 25/09)");
  await expect(f.getByRole("figure", { name: /Kết quả thi đua/ })).toBeVisible();
  await weeks.selectOption({ label: "Tuần 1 (07/09 – 11/09)" });
  await expect(f.getByRole("figure", { name: /Tuần 1/ })).toBeVisible();
  check();
  await tc.close();
  await fc.close();
});
