import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

test("chuyên cần: the register gives a drop for coming to school, and the family sees the month", async ({ browser }) => {
  const ctx = await browser.newContext();
  const t = await ctx.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  const mai = accounts[0]!;

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=chuyen-can`);
  await expect(t.getByRole("heading", { name: /Theo dõi chuyên cần/ })).toBeVisible();

  await t.getByRole("button", { name: "Đánh dấu Nguyễn Thị Mai có mặt" }).click();
  await expect(t.getByRole("button", { name: "Đánh dấu Nguyễn Thị Mai có mặt" })).toHaveAttribute("aria-pressed", "true");
  await t.getByRole("button", { name: "Đánh dấu Trần Văn Tùng nghỉ có phép" }).click();

  // Being at school is worth one drop; being away is worth none.
  await t.goto(`/giao-vien/lop/?id=${classId}`);
  await expect(t.getByRole("button", { name: /Nguyễn Thị Mai có 1 giọt nước/ })).toBeVisible();
  await expect(t.getByRole("button", { name: /Trần Văn Tùng có 0 giọt nước/ })).toBeVisible();

  // Taking it again changes nothing.
  await t.goto(`/giao-vien/lop/?id=${classId}&tab=chuyen-can`);
  await t.getByRole("button", { name: "Đánh dấu Nguyễn Thị Mai có mặt" }).click();
  await t.goto(`/giao-vien/lop/?id=${classId}`);
  await expect(t.getByRole("button", { name: /Nguyễn Thị Mai có 1 giọt nước/ })).toBeVisible();

  const familyCtx = await browser.newContext();
  const f = await familyCtx.newPage();
  const checkFamily = watchConsole(f);
  await studentLogin(f, mai);
  await f.goto("/hoc-sinh/?tab=ket-qua");
  const attendance = f.locator("section", { has: f.getByRole("heading", { name: /Chuyên cần/ }) }).first();
  await expect(attendance.getByText("Có mặt")).toBeVisible();

  check();
  checkFamily();
  await ctx.close();
  await familyCtx.close();
});

test("vinh danh: the teacher crowns the week's star and the whole class sees it", async ({ browser }) => {
  const ctx = await browser.newContext();
  const t = await ctx.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  const mai = accounts[0]!;
  await t.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [mai.id], delta: 5 } });

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=vinh-danh`);
  await t.getByRole("button", { name: /Nguyễn Thị Mai/ }).first().click();
  await t.getByRole("button", { name: /Vinh danh 1 bạn/ }).click();
  const sheet = t.getByRole("dialog");
  await expect(sheet.getByLabel("Danh hiệu")).toHaveValue("Ngôi sao của tuần");
  await sheet.getByLabel(/Lời khen/).fill("Con phát biểu rất sôi nổi.");
  await sheet.getByRole("button", { name: /Vinh danh/ }).click();
  await expect(t.getByRole("heading", { name: "Đã vinh danh kỳ này" })).toBeVisible();

  const familyCtx = await browser.newContext();
  const f = await familyCtx.newPage();
  const checkFamily = watchConsole(f);
  await studentLogin(f, mai);
  // The honours live under Thi đua → Vinh danh since brief 12.
  await f.goto("/hoc-sinh/?tab=thi-dua");
  await f.getByRole("tab", { name: /Vinh danh/ }).click();
  await expect(f.getByText("Ngôi sao của tuần").first()).toBeVisible();
  await expect(f.getByText("Con phát biểu rất sôi nổi.")).toBeVisible();

  check();
  checkFamily();
  await ctx.close();
  await familyCtx.close();
});

test("hồ sơ măng non: the teacher writes a child's page, the child writes their own", async ({ browser }) => {
  const ctx = await browser.newContext();
  const t = await ctx.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  const mai = accounts[0]!;

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=ho-so`);
  await t.getByRole("button", { name: /Sửa trang Măng non của Nguyễn Thị Mai/ }).click();
  const sheet = t.getByRole("dialog");
  await sheet.getByLabel(/Sở thích/).fill("Múa và vẽ tranh");
  await sheet.getByRole("button", { name: "Lớp trưởng", exact: true }).click();
  await sheet.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(t.getByRole("dialog")).toBeHidden();
  const maiCard = t.locator("li").filter({ hasText: "Nguyễn Thị Mai" }).first();
  await expect(maiCard.getByText("Múa và vẽ tranh")).toBeVisible();
  await expect(maiCard.getByText("Lớp trưởng")).toBeVisible();

  // The child fills in their own dream, and cannot give themselves a chức vụ.
  const familyCtx = await browser.newContext();
  const f = await familyCtx.newPage();
  const checkFamily = watchConsole(f);
  await studentLogin(f, mai);
  await f.goto("/hoc-sinh/?tab=ho-so");
  await f.getByRole("button", { name: /Sửa trang của con/ }).click();
  const own = f.getByRole("dialog");
  await expect(own.getByText(/Chức vụ do cô giáo ghi/)).toBeVisible();
  await own.getByLabel(/muốn làm gì/).fill("Làm bác sĩ");
  await own.getByRole("button", { name: /Lưu trang của con/ }).click();
  await expect(f.getByRole("dialog")).toBeHidden();
  const card = f.locator("section").filter({ hasText: "Trang của con" }).first();
  await expect(card.getByText("Làm bác sĩ")).toBeVisible();
  await expect(card.getByText("Múa và vẽ tranh")).toBeVisible();

  check();
  checkFamily();
  await ctx.close();
  await familyCtx.close();
});

test("thi đua theo tổ và bắn tên", async ({ page }) => {
  const check = watchConsole(page);
  const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  await page.request.patch(`/api/t/students/${accounts[0]!.id}`, { data: { group: 1 } });
  await page.request.patch(`/api/t/students/${accounts[1]!.id}`, { data: { group: 2 } });
  await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[0]!.id], delta: 7 } });

  await page.goto(`/giao-vien/lop/?id=${classId}&tab=to-so-do`);
  await expect(page.getByRole("heading", { name: /Bảng thi đua các tổ/ })).toBeVisible();
  await expect(page.getByText(/Tổ 1:/).first()).toBeVisible();
  await page.getByRole("tab", { name: "Năm học" }).click();
  await expect(page.getByText(/Năm học/).first()).toBeVisible();

  // The magic hat calls a child by name, from Trang chủ where she stands (it replaced the bow in brief 14).
  await page.goto(`/giao-vien/lop/?id=${classId}`);
  await page.getByRole("button", { name: /Gọi ngẫu nhiên/ }).click();
  const pick = page.getByRole("dialog");
  await pick.getByRole("tab", { name: /Chiếc mũ bí mật/ }).click();
  await pick.getByRole("button", { name: /Gõ mũ/ }).click();
  await expect(page.getByRole("alertdialog", { name: "Bạn được chọn" }).getByText(/Từ chiếc mũ bí mật/)).toBeVisible({ timeout: 15_000 });

  check();
});
