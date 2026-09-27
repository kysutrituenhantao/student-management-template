import { expect, test } from "@playwright/test";
import { registerTeacher, tag, watchConsole } from "./helpers";

test("a wrong invite code is refused with a clear message", async ({ page }) => {
  await page.goto("/giao-vien/dang-ky/");
  await page.getByLabel("Mã mời").fill("sai-ma");
  await page.getByLabel("Tên hiển thị").fill("Cô Hạnh");
  await page.getByLabel("Tên đăng nhập").fill(`co${tag()}`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("mat-khau-cua-co");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByText("Mã mời chưa đúng.")).toBeVisible();
});

test("a teacher creates a class, pastes the class list and gets an account for every child", async ({ page, context }) => {
  const check = watchConsole(page);
  await registerTeacher(page);
  await page.getByRole("button", { name: /Tạo lớp mới/ }).first().click();
  const className = `Lớp 4C ${tag()}`;
  await page.getByLabel("Tên lớp").fill(className);
  await page.getByRole("button", { name: "Tạo lớp", exact: true }).click();

  // New class: straight to the students tab with the bulk-add sheet open.
  await expect(page.getByRole("heading", { name: "Thêm học sinh" })).toBeVisible();
  await page.getByLabel("Danh sách lớp, mỗi bạn một dòng").fill("1. Nguyễn Văn Bình\n2. TRẦN THỊ HOA, 2\n3. Lê Minh Châu, 1\n\n");
  await expect(page.getByText("Xem trước (3 bạn)")).toBeVisible();
  await expect(page.getByText("Trần Thị Hoa", { exact: true })).toBeVisible();

  // Every child needs a tổ: Bình has none, so the button waits until she shares them out.
  await expect(page.getByText("1 bạn chưa có tổ.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tạo 3 tài khoản/ })).toBeDisabled();
  await page.getByRole("button", { name: "Chia tổ tự động" }).click();
  await expect(page.getByText("Chưa có tổ")).toHaveCount(0);
  await page.getByRole("button", { name: "Tạo 3 tài khoản" }).click();
  await expect(page.getByRole("heading", { name: /Đã tạo 3 tài khoản/ })).toBeVisible();
  await page.getByRole("button", { name: "Xong" }).click();

  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText("Trần Thị Hoa");
  await expect(rows.nth(1)).toContainText("Tổ 2");
  // "Tên lót-tên" (brief 6); no birthday in this list, so no day after it.
  await expect(rows.nth(1)).toContainText(/thihoa[a-z]*/);

  // Printable account slips, with the password the teacher hands to the family.
  const [slips] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: "In phiếu tài khoản" }).click()]);
  await expect(slips.getByText("Lê Minh Châu")).toBeVisible();
  await expect(slips.locator("li").first().locator("dd").nth(2)).toHaveText("Abc12345");
  await slips.close();
  check();
});

test("a teacher scores from the sticker: +💧 at once, undo, a reason later, and a level-up celebration", async ({ page, request }) => {
  const check = watchConsole(page);
  await registerTeacher(page);
  const created = await page.request.post("/api/t/classes", { data: { name: `Lớp 4D ${tag()}`, grade: 4, schoolYear: "2026-2027" } });
  const { id } = await created.json();
  await page.request.post(`/api/t/classes/${id}/students`, { data: { students: [{ fullName: "Phạm Gia Huy", group: 1 }, { fullName: "Đỗ Ngọc Lan", group: 2 }] } });
  await page.goto(`/giao-vien/lop/?id=${id}`);
  await expect(page.getByRole("heading", { name: /Vườn hoa của lớp/ })).toBeVisible();

  const plus = page.getByRole("button", { name: "Cộng 1 giọt nước cho Phạm Gia Huy" });
  await plus.click();
  await expect(page.getByRole("button", { name: /Phạm Gia Huy có 1 giọt nước/ })).toBeVisible();
  await expect(page.getByText("Huy +1 💧")).toBeVisible();

  // Undo the tap.
  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(page.getByRole("button", { name: /Phạm Gia Huy có 0 giọt nước/ })).toBeVisible();

  // Tap again, then name the reason from the undo bar.
  await plus.click();
  await page.getByRole("button", { name: "Thêm lý do" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Phát biểu/ }).click();
  await expect(page.getByText("Đã ghi lý do: Phát biểu.")).toBeVisible();

  // The quick menu: +10 takes Huy past 10 drops, so his plant sprouts.
  await page.getByRole("button", { name: /Phạm Gia Huy có 1 giọt nước/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "+10 💧" }).click();
  await expect(page.getByText("Cây của Huy vừa lớn lên!")).toBeVisible();
  await page.getByRole("button", { name: "❤️ Tuyệt vời!" }).click();
  await expect(page.getByRole("button", { name: /Phạm Gia Huy có 11 giọt nước/ })).toBeVisible();

  // Several children at once, by a criterion: one tap gives what it is worth (brief 7; Giúp bạn starts at 1).
  await page.getByRole("button", { name: "☑️ Chọn nhiều bạn" }).click();
  await page.getByRole("button", { name: "Cả lớp đang hiện" }).click();
  await page.getByRole("button", { name: "Chấm điểm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Giúp bạn \+1 💧/ }).click();
  await expect(page.getByRole("button", { name: /Sticker của Đỗ Ngọc Lan .*💧 1$/ })).toBeVisible();

  // It all lands in the history.
  await page.getByRole("button", { name: /Lịch sử/ }).click();
  const history = page.getByRole("dialog");
  await expect(history.getByText("Giúp bạn")).toHaveCount(2);
  await expect(history.getByText("Phát biểu")).toBeVisible();
  void request;
  check();
});

test("the teacher's pages have no sideways scroll on a laptop", async ({ page }) => {
  await registerTeacher(page);
  const res = await page.request.post("/api/t/classes", { data: { name: `Lớp 4E ${tag()}`, grade: 4, schoolYear: "2026-2027" } });
  const { id } = await res.json();
  for (const tab of ["", "&tab=nhiem-vu", "&tab=tai-khoan", "&tab=bao-cao", "&tab=to-so-do", "&tab=doi-qua", "&tab=huy-hieu", "&tab=loi-nhan", "&tab=cai-dat"]) {
    await page.goto(`/giao-vien/lop/?id=${id}${tab}`);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, tab).toBeLessThanOrEqual(0);
  }
});

test("accounts: the slips carry each child's account, and a reset goes back to Abc12345", async ({ page, context, browser }) => {
  await registerTeacher(page);
  const res = await page.request.post("/api/t/classes", { data: { name: `Lớp 4G ${tag()}`, grade: 4, schoolYear: "2026-2027" } });
  const { id } = await res.json();
  await page.request.post(`/api/t/classes/${id}/students`, {
    data: {
      students: [
        { fullName: "Mạc Thị Yến", group: 1 },
        { fullName: "Tôn Đức Lộc", group: 2 },
      ],
    },
  });
  await page.goto(`/giao-vien/lop/?id=${id}&tab=tai-khoan`);

  const [slips] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: "In phiếu tài khoản" }).click()]);
  const first = slips.locator("li").first();
  await expect(first).toContainText("Mạc Thị Yến");
  const username = (await first.locator("dd").nth(1).textContent())!.trim();
  expect(username).toMatch(/^thiyen[a-z]*$/);
  await slips.close();

  await page.getByRole("button", { name: "Đặt lại mật khẩu cho Mạc Thị Yến" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  const shown = page.getByRole("dialog", { name: "Mật khẩu mới" });
  await expect(shown).toContainText(username);
  const code = (await shown.locator("dd").nth(1).textContent())!.trim();
  expect(code).toBe("Abc12345");

  // The family signs in with it, and chooses its own password before anything else.
  const family = await browser.newContext();
  const f = await family.newPage();
  await f.goto("/dang-nhap/");
  await f.getByLabel("Tên đăng nhập").fill(username);
  await f.getByLabel("Mật khẩu", { exact: true }).fill(code);
  await f.getByRole("button", { name: "Vào lớp" }).click();
  await expect(f.getByRole("heading", { name: "Đặt mật khẩu riêng" })).toBeVisible();
  await family.close();
});
