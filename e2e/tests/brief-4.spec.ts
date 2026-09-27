import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/**
 * Her fourth brief, the evening of 24 September 2026: the red lines in `3.docx`. Black she had already ticked off.
 * One test per red item, in her numbering, so a regression names itself.
 */

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Item 3's movement ("vòng quay 2-3 vòng", "bắn tên chậm hơn", "đua vịt 5-7s") was rewritten by her in brief 14;
// brief-14.spec.ts holds the games as they are now.

test("4 + 8. Lời nhắn is on the toolbar, and she can start a conversation from it", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai"]);

  await t.goto(`/giao-vien/lop/?id=${classId}`);
  // Her ten, in her order — on one row since brief 5 (see brief-5.spec.ts).
  const bar = t.getByRole("tablist", { name: "Thanh công cụ" });
  await expect(bar.getByRole("tab")).toHaveText([
    /Trang chủ/, /Bảng tin/, /Nhiệm vụ/, /Hồ sơ Măng non/, /Chuyên cần/, /Sơ đồ lớp/, /Báo cáo/, /Thi đua/, /Đổi thưởng/, /Lời nhắn/,
  ]);

  await bar.getByRole("tab", { name: /Lời nhắn/ }).click();
  await expect(t.getByRole("heading", { name: "💌 Lời nhắn" })).toBeVisible();
  await t.getByRole("button", { name: /Nguyễn Thị Mai/ }).last().click();
  await t.getByRole("textbox", { name: "Tin nhắn" }).fill("Chào gia đình, con học rất chăm ạ.");
  await t.getByRole("button", { name: "Gửi" }).click();
  // In the conversation itself: the family list beside it also previews the last message, once it refreshes.
  await expect(t.getByRole("log", { name: "Cuộc trò chuyện" }).getByText("Chào gia đình, con học rất chăm ạ.")).toBeVisible();

  // And the family reads it, and answers.
  const fc = await browser.newContext();
  const f = await fc.newPage();
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=nhan-co");
  await expect(f.getByText("Chào gia đình, con học rất chăm ạ.")).toBeVisible();
  await f.getByRole("textbox", { name: "Tin nhắn" }).fill("Cảm ơn cô ạ.");
  await f.getByRole("button", { name: "Gửi" }).click();

  await t.reload();
  // Wherever it shows first — the preview in the list, or the open conversation — it has reached her.
  await expect(t.getByText("Cảm ơn cô ạ.").first()).toBeVisible();
  check();
  await tc.close();
  await fc.close();
});

test("5. Sản phẩm của em: she puts work up, the family looks at it and is offered no copy", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=ho-so`);
  await t.getByRole("button", { name: /Sửa trang Măng non của Nguyễn Thị Mai/ }).click();
  const sheet = t.getByRole("dialog");
  await expect(sheet.getByText("Sản phẩm của em")).toBeVisible();
  const works = sheet.locator("fieldset", { hasText: "Sản phẩm của em" });
  await works.getByLabel("Tên sản phẩm").fill("Bài kiểm tra Toán tuần 5");
  await works
    .locator('input[type="file"]')
    .setInputFiles({ name: "bai-kiem-tra.png", mimeType: "image/png", buffer: Buffer.from(PNG.split(",")[1]!, "base64") });
  await expect(works.getByRole("listitem").filter({ hasText: "Bài kiểm tra Toán tuần 5" })).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "Lưu", exact: true }).click();

  // The family finds it under Kết quả, under the name she gave it.
  const fc = await browser.newContext();
  const f = await fc.newPage();
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=ket-qua");
  const gallery = f.locator("section", { has: f.getByRole("heading", { name: /Sản phẩm của em/ }) });
  await expect(gallery.getByText("Bài kiểm tra Toán tuần 5")).toBeVisible();
  // "PH k tải đc tài liệu do gv upload mà chỉ xem": nothing here offers a copy.
  await expect(gallery.locator("a[download]")).toHaveCount(0);
  await expect(gallery.locator("img").first()).toHaveJSProperty("draggable", false);

  // A classmate's family sees nothing of it.
  const oc = await browser.newContext();
  const o = await oc.newPage();
  await studentLogin(o, accounts[1]!);
  await o.goto("/hoc-sinh/?tab=ket-qua");
  await expect(o.getByText("Chưa có sản phẩm nào")).toBeVisible();
  check();
  await tc.close();
  await fc.close();
  await oc.close();
});

test("6. a tile on the board wears a sticker, and the family sees it", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai"]);

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=bang-tin`);
  await t.getByRole("button", { name: /Thêm ô tin/ }).click();
  const sheet = t.getByRole("dialog");
  await sheet.getByLabel("Tiêu đề").fill("Hội chợ xuân của lớp");
  await sheet.getByRole("button", { name: "Sticker 🎉" }).click();
  await sheet.getByRole("button", { name: "Khung ảnh" }).click();
  await sheet.getByRole("button", { name: /Đăng lên bảng/ }).click();
  await expect(t.getByRole("dialog")).toBeHidden();

  const note = t.locator("article", { hasText: "Hội chợ xuân của lớp" });
  await expect(note).toHaveClass(/note-khung/);
  await expect(note.locator(".note-sticker")).toHaveText("🎉");

  const fc = await browser.newContext();
  const f = await fc.newPage();
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=bang-tin");
  await expect(f.locator("article", { hasText: "Hội chợ xuân của lớp" }).locator(".note-sticker")).toHaveText("🎉");
  check();
  await tc.close();
  await fc.close();
});

test("7. Học sinh lives inside Hồ sơ Măng non, as two little tabs", async ({ page }) => {
  const check = watchConsole(page);
  const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  await page.goto(`/giao-vien/lop/?id=${classId}`);

  // There is no Học sinh tab on the bar any more.
  await expect(page.getByRole("tab", { name: /^👧 Học sinh$/ })).toHaveCount(0);

  await page.getByRole("tab", { name: /Hồ sơ Măng non/ }).click();
  const subs = page.getByRole("tablist", { name: "Mục nhỏ" });
  await expect(subs.getByRole("tab")).toHaveText([/Hồ sơ Măng non/, /Tài khoản học sinh/]);
  await expect(page.getByRole("heading", { name: /Hồ sơ Măng non/ })).toBeVisible();

  await subs.getByRole("tab", { name: /Tài khoản học sinh/ }).click();
  await expect(page.getByRole("heading", { name: /Tài khoản học sinh/ })).toBeVisible();
  // The sub-tab stays lit, and so does the tab it lives under.
  await expect(page.getByRole("tab", { name: /Hồ sơ Măng non/ }).first()).toHaveAttribute("aria-selected", "true");
  check();
});

test("8. the toolbar is ten buttons, and Cài đặt moved to her menu", async ({ page }) => {
  const check = watchConsole(page);
  const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  await page.goto(`/giao-vien/lop/?id=${classId}`);

  const bar = page.locator('nav[aria-label="Các mục của lớp"]');
  // Ten, as she asked. The two rows became one in brief 5 — brief-5.spec.ts holds how they sit on each screen.
  await expect(bar.getByRole("tab")).toHaveCount(10);

  await page.getByRole("button", { name: /Cô Hạnh/ }).click();
  await page.getByRole("link", { name: /Cài đặt lớp/ }).click();
  await expect(page.getByRole("heading", { name: /Cài đặt/ })).toBeVisible();
  check();
});

test("13. the plant is drawn, and it is the biggest thing in the row after the child's face", async ({ page }) => {
  const check = watchConsole(page);
  const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  // Enough drops to be past a seed, so the picture has something to say.
  await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[0]!.id], delta: 12 } });

  await page.goto(`/giao-vien/lop/?id=${classId}`);
  const row = page.locator("li", { hasText: "Nguyễn Thị Mai" }).first();
  const plant = row.getByRole("img", { name: "Nảy mầm" });
  await expect(plant).toBeVisible();
  // "Mong muốn icon cây to hơn, rõ hơn": a 0.86rem emoji was about 14px.
  const box = (await plant.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(30);
  check();
});

test("54. her ladder: blossom at 300, ripe fruit at 500, then a level every hundred for ever", async ({ page }) => {
  const check = watchConsole(page);
  const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  const mai = accounts[0]!;

  /** A drop award is capped at 20, so a big total is a handful of taps — as it would be over a term. */
  const water = async (total: number) => {
    for (let left = total; left > 0; left -= 20) {
      const r = await page.request.post(`/api/t/classes/${classId}/points`, {
        data: { studentIds: [mai.id], delta: Math.min(20, left) },
      });
      expect(r.status(), await r.text()).toBe(201);
    }
  };
  const row = () => page.locator("li", { hasText: "Nguyễn Thị Mai" }).first();

  await water(300);
  await page.goto(`/giao-vien/lop/?id=${classId}`);
  // "800 giọt hs è khóc ngất vì kb bao giờ cây ra hoa" — it flowers at 300 now.
  await expect(row().getByRole("img", { name: "Cây nở hoa" })).toBeVisible();
  await expect(row()).toContainText("Lv 8");

  await water(200);
  await page.reload();
  await expect(row().getByRole("img", { name: "Quả chín" })).toBeVisible();
  await expect(row()).toContainText("Lv 10");

  // "Sau 500 cây tự thêm level mỗi lần thêm 100 giọt… chỉ thay đổi lv."
  await water(100);
  await page.reload();
  await expect(row()).toContainText("Lv 11");
  await expect(row().getByRole("img", { name: "Quả chín" })).toBeVisible();
  check();
});
