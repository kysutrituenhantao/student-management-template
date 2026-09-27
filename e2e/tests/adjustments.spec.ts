import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/**
 * Her third brief, 24 September 2026: "Vấn đề cần điều chỉnh", written after a day of teaching with it.
 * One test per item, in her order, so a regression names itself.
 */

// A 1×1 PNG and a tiny WebP: two different pictures, which is all this needs.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const WEBP = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

test("1. a child's photo can be changed, and again after it is taken off", async ({ page }) => {
  const check = watchConsole(page);
  const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  const mai = accounts[0]!;

  const first = await page.request.put(`/api/t/students/${mai.id}/avatar`, { data: { dataUrl: PNG } });
  const a = ((await first.json()) as { avatarUrl: string }).avatarUrl;
  await page.request.delete(`/api/t/students/${mai.id}/avatar`);
  const second = await page.request.put(`/api/t/students/${mai.id}/avatar`, { data: { dataUrl: WEBP } });
  const b = ((await second.json()) as { avatarUrl: string }).avatarUrl;
  // A photo is cached for a year: a new one must never land on the old URL, or the old face keeps showing.
  expect(b).not.toBe(a);

  // And from her screen: a sticker replaces the photo in one tap.
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=tai-khoan`);
  await page.getByRole("button", { name: "Sửa thông tin Nguyễn Thị Mai" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Chọn một sticker sẽ bỏ ảnh đang dùng.")).toBeVisible();
  await sheet.getByRole("button", { name: "🦄" }).click();
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("tbody tr", { hasText: "Nguyễn Thị Mai" }).getByText("🦄")).toBeVisible();
  check();
});

/**
 * Where she actually looked. The avatar sits at the top of a child's Măng non page — the profile screen — and
 * until now nothing there could change it. Production had no stored photo at all, so the cache bug above was
 * never what she hit.
 */
test("1b. the avatar can be changed from the child's Măng non page, by her and by the child", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai"]);

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=ho-so`);
  await t.getByRole("button", { name: /Sửa trang Măng non của Nguyễn Thị Mai/ }).click();
  const sheet = t.getByRole("dialog");
  await sheet.getByRole("button", { name: "Chọn sticker 🦄" }).click();
  await sheet.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(t.getByRole("dialog")).toBeHidden();
  await expect(t.locator("li").filter({ hasText: "Nguyễn Thị Mai" }).first().getByText("🦄")).toBeVisible();

  // The child can change their own from the same place.
  const fc = await browser.newContext();
  const f = await fc.newPage();
  const checkFamily = watchConsole(f);
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=ho-so");
  await f.getByRole("button", { name: /Sửa trang của con/ }).click();
  const own = f.getByRole("dialog");
  await own.getByRole("button", { name: "Chọn sticker 🐧" }).click();
  await own.getByRole("button", { name: /Lưu trang của con/ }).click();
  await expect(f.getByRole("dialog")).toBeHidden();
  await expect(f.locator("section").filter({ hasText: "Trang của con" }).first().getByText("🐧")).toBeVisible();

  check();
  checkFamily();
  await tc.close();
  await fc.close();
});

test("3. she picks how to call a name: quick, wheel, hat or ducks — and gives the drop from there", async ({ page }) => {
  const check = watchConsole(page);
  const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  await page.goto(`/giao-vien/lop/?id=${classId}`);
  await page.getByRole("button", { name: /Gọi ngẫu nhiên/ }).click();
  const sheet = page.getByRole("dialog");
  for (const way of ["Gọi nhanh", "Vòng quay may mắn", "Chiếc mũ bí mật", "Đua vịt"]) {
    await expect(sheet.getByRole("tab", { name: new RegExp(way) })).toBeVisible();
  }

  // The bow became the magic hat in brief 14.
  await sheet.getByRole("tab", { name: /Chiếc mũ bí mật/ }).click();
  await sheet.getByRole("button", { name: /Gõ mũ/ }).click();
  // The chosen name opens in its own window (brief 16).
  const chosen = page.getByRole("alertdialog", { name: "Bạn được chọn" });
  await expect(chosen.getByText(/Từ chiếc mũ bí mật/)).toBeVisible({ timeout: 10_000 });
  await chosen.getByRole("button", { name: /^\+1 💧 cho/ }).click();
  await expect(page.getByText(/💧/).first()).toBeVisible();
  check();
});

test("5. she edits a tổ's members from the tổ, several at a time", async ({ page }) => {
  const check = watchConsole(page);
  const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Thị Mai", "Trần Văn Tùng", "Lê Bảo Anh"]);
  // apiClassroom spreads them over tổ 1 and 2: Mai and Bảo Anh in 1, Tùng in 2.
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=to-so-do`);
  const to1 = page.locator("li", { hasText: "Tổ 1:" }).first();
  await to1.getByRole("button", { name: "Sửa tổ" }).click();

  const sheet = page.getByRole("dialog", { name: "Sửa Tổ 1" });
  await expect(sheet.getByText(/Thành viên của tổ 1 \(2 bạn\)/)).toBeVisible();
  // Bring Tùng over from tổ 2. A child already in tổ 1 stays: every child belongs to a tổ.
  await sheet.getByRole("button", { name: /Trần Văn Tùng/ }).click();
  await expect(sheet.getByText("1 bạn sẽ chuyển sang tổ 1 khi cô bấm Lưu.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Nguyễn Thị Mai/ })).toHaveAttribute("aria-disabled", "true");
  // The tổ trưởng can only be someone who will be in it.
  await expect(sheet.getByLabel("Tổ trưởng")).toContainText("Trần Văn Tùng");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText(/Đã lưu tổ và chuyển 1 bạn sang tổ 1/)).toBeVisible();

  await expect(page.locator("li", { hasText: "Tổ 1:" }).first()).toContainText("3 thành viên");
  await expect(page.locator("li", { hasText: "Tổ 2:" }).first()).toContainText("0 thành viên");
  check();
});

test("6. the register says it gave the drop, and gives it", async ({ page }) => {
  const check = watchConsole(page);
  const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=chuyen-can`);
  await page.getByRole("button", { name: /Cả lớp có mặt/ }).click();
  await expect(page.getByText("Đã điểm danh và cộng 1 💧 cho 2 bạn.")).toBeVisible();
  await expect(page.getByText(/Đã tặng 2 giọt nước chuyên cần hôm nay/)).toBeVisible();

  await page.goto(`/giao-vien/lop/?id=${classId}`);
  await expect(page.getByRole("button", { name: /Nguyễn Thị Mai có 1 giọt nước/ })).toBeVisible();
  check();
});

test("7. vinh danh opens on a podium, and the rest follow as a list", async ({ page }) => {
  const check = watchConsole(page);
  const names = ["Nguyễn Thị Mai", "Trần Văn Tùng", "Lê Bảo Anh", "Phạm Gia Huy"];
  const { classId, accounts } = await apiClassroom(page.request, names);
  // Four clear places: 10, 7, 5, 2 drops.
  for (const [i, delta] of [10, 7, 5, 2].entries()) {
    await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[i]!.id], delta } });
  }
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=vinh-danh`);

  const podium = page.getByRole("button", { name: /Quán quân/ });
  await expect(podium).toContainText("Nguyễn Thị Mai");
  await expect(page.getByRole("button", { name: /Á quân 1/ })).toContainText("Trần Văn Tùng");
  await expect(page.getByRole("button", { name: /Á quân 2/ })).toContainText("Lê Bảo Anh");
  // Fourth onwards is a plain row, not a step on the podium.
  await expect(page.locator("li", { hasText: "Phạm Gia Huy" }).first()).toContainText("4");

  // Crowning still works from the podium itself.
  await podium.click();
  await page.getByRole("button", { name: /Vinh danh 1 bạn/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Vinh danh 1 bạn/ }).click();
  await expect(page.getByText(/Đã vinh danh Nguyễn Thị Mai/)).toBeVisible();
  check();
});

test("8. the class opens as a vertical list, and the grid is one tap away", async ({ page }) => {
  const check = watchConsole(page);
  const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  for (const delta of [20, 3]) {
    const r = await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[0]!.id], delta } });
    expect(r.status(), await r.text()).toBe(201);
  }
  await page.goto(`/giao-vien/lop/?id=${classId}`);

  await expect(page.getByRole("button", { name: "☰ Danh sách" })).toHaveAttribute("aria-pressed", "true");
  // Her row: ảnh, tên, Lv với hình cây, tổ, rồi giọt nước.
  const row = page.getByRole("list", { name: "Học sinh của lớp" }).locator("li", { hasText: "Nguyễn Thị Mai" });
  await expect(row).toContainText("Lv 2");
  await expect(row).toContainText("Tổ 1");
  await expect(row.getByRole("button", { name: /Nguyễn Thị Mai có 23 giọt nước/ })).toBeVisible();
  // Scoring from the row works the same as from a sticker.
  await row.getByRole("button", { name: /Cộng 1 giọt nước cho Nguyễn Thị Mai/ }).click();
  await expect(row.getByRole("button", { name: /có 24 giọt nước/ })).toBeVisible();

  await page.getByRole("button", { name: "▦ Ô vuông" }).click();
  await expect(page.getByRole("button", { name: "▦ Ô vuông" })).toHaveAttribute("aria-pressed", "true");
  // And she is not asked again next time she opens the class.
  await page.reload();
  await expect(page.getByRole("button", { name: "▦ Ô vuông" })).toHaveAttribute("aria-pressed", "true");
  check();
});

test("9. a message from a family reaches her on the screen she teaches from", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Lê Hoàng Nam"]);

  const fc = await browser.newContext();
  const f = await fc.newPage();
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=nhan-co");
  await f.getByLabel("Tin nhắn").fill("Thưa cô, mai con xin nghỉ ạ.");
  await f.getByRole("button", { name: "Gửi" }).click();
  await expect(f.getByText("Thưa cô, mai con xin nghỉ ạ.")).toBeVisible();

  // Trang chủ is where she stands all lesson: the count has to be there, not only on the 13th tab.
  await t.goto(`/giao-vien/lop/?id=${classId}`);
  const stat = t.locator("li", { hasText: "lời nhắn mới của phụ huynh" });
  await expect(stat).toContainText("1");
  await stat.getByRole("button").click();
  await t.getByRole("button", { name: /Lê Hoàng Nam/ }).first().click();
  await expect(t.getByRole("log").getByText("Thưa cô, mai con xin nghỉ ạ.")).toBeVisible();

  await t.getByLabel("Tin nhắn").fill("Cô biết rồi, con nghỉ ngơi nhé.");
  await t.getByRole("button", { name: "Gửi" }).click();
  await expect(t.getByRole("log").getByText("Cô biết rồi, con nghỉ ngơi nhé.")).toBeVisible();

  // Once read, the home screen stops nagging.
  await t.goto(`/giao-vien/lop/?id=${classId}`);
  await expect(t.locator("li", { hasText: "lời nhắn mới của phụ huynh" })).toContainText("0");
  check();
  await tc.close();
  await fc.close();
});
