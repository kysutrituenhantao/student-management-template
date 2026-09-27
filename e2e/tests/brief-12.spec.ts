import { expect, test, type Page } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/**
 * Brief 12, 25 September 2026: Vinh danh becomes Thi đua — "Kết quả thi đua" first, with the school's classes in a
 * column chart from highest to lowest and her class always red; Vinh danh as it was; Huy hiệu she can rename. Families
 * get it in place of Huy hiệu: tab 1 and 2 whole, tab 3 only their own child's badges. And the task notes hang straight.
 */

const RED = "rgb(217, 45, 72)";

/** The chart's columns, left to right: name, score, colour. */
async function columns(page: Page) {
  const chart = page.getByRole("figure", { name: /Kết quả thi đua/ });
  await expect(chart).toBeVisible();
  return chart.locator("[data-column]").evaluateAll((els) =>
    els.map((e) => ({
      name: e.getAttribute("data-name"),
      score: Number(e.getAttribute("data-score")),
      colour: getComputedStyle(e.querySelector("[data-bar]")!).backgroundColor,
      height: (e.querySelector("[data-bar]") as HTMLElement).offsetHeight,
    })),
  );
}

test("Thi đua: she enters the school's results, the chart sorts them and her class is red; families see it too", async ({ browser }) => {
  const tc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  const cls = (await (await t.request.get(`/api/t/classes/${classId}`)).json()) as { class: { name: string } };
  const ours = cls.class.name;

  await t.goto(`/giao-vien/lop/?id=${classId}`);
  // Vinh danh is now Thi đua, in the same place on the bar.
  const bar = t.getByRole("tablist", { name: "Thanh công cụ" });
  await expect(bar.getByRole("tab")).toHaveText([
    /Trang chủ/, /Bảng tin/, /Nhiệm vụ/, /Hồ sơ Măng non/, /Chuyên cần/, /Sơ đồ lớp/, /Báo cáo/, /Thi đua/, /Đổi thưởng/, /Lời nhắn/,
  ]);
  await bar.getByRole("tab", { name: /Thi đua/ }).click();
  const subs = t.getByRole("tablist", { name: "Mục nhỏ" });
  await expect(subs.getByRole("tab")).toHaveText([/Kết quả thi đua/, /Vinh danh/, /Huy hiệu/]);
  await expect(t.getByRole("heading", { name: /Kết quả thi đua/ })).toBeVisible();

  // She types the week's results: her class is already on the list, marked as hers.
  await t.getByRole("button", { name: /Nhập kết quả/ }).click();
  const sheet = t.getByRole("dialog");
  await expect(sheet.getByLabel("Tên lớp 1")).toHaveValue(ours);
  await sheet.getByLabel("Điểm 1").fill("97,5");
  for (const [name, score] of [["Lớp 4A", "95"], ["Lớp 4B", "99"], ["Lớp 5A", "90"]] as const) {
    await sheet.getByRole("button", { name: /Thêm lớp/ }).click();
    const n = await sheet.getByLabel(/^Tên lớp \d+$/).count();
    await sheet.getByLabel(`Tên lớp ${n}`).fill(name);
    await sheet.getByLabel(`Điểm ${n}`).fill(score);
  }
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(sheet).toBeHidden();

  // Highest first, her class red and the only red, taller columns for higher scores.
  const cols = await columns(t);
  expect(cols.map((c) => c.name)).toEqual(["Lớp 4B", ours, "Lớp 4A", "Lớp 5A"]);
  expect(cols.map((c) => c.score)).toEqual([99, 97.5, 95, 90]);
  expect(cols.filter((c) => c.colour === RED).map((c) => c.name)).toEqual([ours]);
  for (let i = 1; i < cols.length; i++) expect(cols[i]!.height).toBeLessThanOrEqual(cols[i - 1]!.height);
  await expect(t.getByText(new RegExp(`${ours} đứng thứ 2/4`))).toBeVisible();

  // Next week starts from this week's classes; she only types the scores.
  await t.getByRole("button", { name: "Tuần sau" }).click();
  await t.getByRole("button", { name: /Nhập kết quả/ }).click();
  await expect(t.getByRole("dialog").getByLabel(/^Tên lớp \d+$/)).toHaveCount(4);
  await t.getByRole("dialog").getByRole("button", { name: "Thôi" }).click();
  await t.getByRole("button", { name: "Tuần trước" }).click();

  // Huy hiệu: she renames one, icon and words.
  await subs.getByRole("tab", { name: /Huy hiệu/ }).click();
  await t.getByRole("button", { name: "Sửa huy hiệu Mọt sách nhí" }).click();
  const edit = t.getByRole("dialog");
  await edit.getByLabel("Biểu tượng").fill("📚");
  await edit.getByLabel("Tên huy hiệu").fill("Bạn đọc chăm chỉ");
  await edit.getByLabel("Nội dung").fill("Đọc hết 5 cuốn sách trong tháng");
  await edit.getByRole("button", { name: "Lưu" }).click();
  await expect(t.getByRole("heading", { name: "Bạn đọc chăm chỉ" })).toBeVisible();
  await expect(t.getByText("Đọc hết 5 cuốn sách trong tháng")).toBeVisible();
  // …and gives it to Mai.
  await t.getByRole("listitem").filter({ hasText: "Bạn đọc chăm chỉ" }).getByRole("button", { name: /Trao/ }).click();
  await t.getByRole("dialog").getByRole("button", { name: /Mai/ }).click();
  await t.getByRole("dialog").getByRole("button", { name: /^Trao/ }).last().click();
  await expect(t.getByRole("dialog")).toBeHidden();
  // Some drops this week, so Mai has a place in the class.
  await t.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[1]!.id], delta: 5 } });
  await t.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[0]!.id], delta: 3 } });
  check();

  // The family, on a phone: Thi đua where Huy hiệu was.
  const fc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const f = await fc.newPage();
  const checkFamily = watchConsole(f);
  await studentLogin(f, accounts[0]!);
  const nav = f.getByRole("navigation").last();
  await expect(nav.getByRole("button", { name: /^Huy hiệu$/ })).toHaveCount(0);
  await nav.getByRole("button", { name: /^Thi đua$/ }).click();
  const theirs = await columns(f);
  expect(theirs.map((c) => c.name)).toEqual(["Lớp 4B", ours, "Lớp 4A", "Lớp 5A"]);
  expect(theirs.filter((c) => c.colour === RED).map((c) => c.name)).toEqual([ours]);
  await expect(f.getByRole("button", { name: /Nhập kết quả/ })).toHaveCount(0);

  // Vinh danh: where Mai stands this week.
  await f.getByRole("tab", { name: /Vinh danh/ }).click();
  await expect(f.getByText(/Mai đứng thứ 2\/2 trong lớp/)).toBeVisible();

  // Huy hiệu: only Mai's own — the one the teacher gave, in her words, and the one the app gave for the first drop —
  // and none of the badges Mai hasn't earned.
  await f.getByRole("tab", { name: /Huy hiệu/ }).click();
  const mine = f.getByRole("list", { name: "Huy hiệu của con" }).getByRole("listitem");
  await expect(mine).toHaveCount(2);
  await expect(mine.filter({ hasText: "Bạn đọc chăm chỉ" })).toHaveCount(1);
  await expect(mine.filter({ hasText: "Giọt nước đầu tiên" })).toHaveCount(1);
  await expect(f.getByText("Chăm ngoan")).toHaveCount(0);

  // An old link to the family's Huy hiệu still lands.
  await f.goto("/hoc-sinh/?tab=huy-hieu");
  await expect(f.getByRole("list", { name: "Huy hiệu của con" })).toBeVisible();
  const overflow = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  checkFamily();
  await tc.close();
  await fc.close();
});
