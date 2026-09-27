import { expect, test } from "@playwright/test";
import { apiClassroom, registerTeacher, tag, watchConsole } from "./helpers";

/**
 * Brief 6, 24 September 2026: "Tạo tài khoản và mật khẩu học sinh tự động theo mẫu: tên lót-tên-ngày sinh. Ví dụ:
 * minhanh27; hoaian22; ngocanh01. Mật khẩu: Abc12345".
 */

test("she pastes the list with birthdays and gets minhanh27, hoaian22, ngocanh01 — all on Abc12345", async ({ page }) => {
  const check = watchConsole(page);
  await registerTeacher(page);
  const res = await page.request.post("/api/t/classes", { data: { name: `Lớp 4E ${tag()}`, grade: 4, schoolYear: "2026-2027" } });
  const { id } = (await res.json()) as { id: number };
  await page.goto(`/giao-vien/lop/?id=${id}&tab=tai-khoan&them=1`);

  await page
    .getByLabel("Danh sách lớp, mỗi bạn một dòng")
    .fill(`1\tNguyễn Thị Minh Anh\t27/03/2016\t1\n2\tTrần Hoài An\t22/11/2016\t2\n3\tLê Thị Ngọc Ánh\t01/05/2016\t1`);
  // The preview shows each username before anything is made.
  const preview = page.locator("ol");
  await expect(preview).toContainText("hoaian22");
  await expect(preview).toContainText("ngocanh01");
  await page.getByRole("button", { name: "Tạo 3 tài khoản" }).click();
  await expect(page.getByRole("heading", { name: /Đã tạo 3 tài khoản/ })).toBeVisible();
  const made = page.getByRole("dialog");
  await expect(made.getByText(/^hoaian22[a-z]*$/)).toBeVisible();
  await expect(made.getByText("Abc12345")).toHaveCount(3);
  await page.getByRole("button", { name: "Xong" }).click();
  // The list shows them at once, without reloading the page.
  await page.getByRole("button", { name: /Hiện mật khẩu/ }).click();
  await expect(page.locator("tbody").getByText("Abc12345")).toHaveCount(3);
  check();
});

test("a family signing in with Abc12345 chooses its own password, then is in", async ({ page }) => {
  // The one 400 is the refusal of abc12345 below, which is the point.
  const check = watchConsole(page, [/status of 400/]);
  const { accounts } = await apiClassroom(page.request, ["Trần Hoài An"]);
  await page.request.post("/api/auth/logout", { data: {} });
  await page.goto("/dang-nhap/");
  await page.getByLabel("Tên đăng nhập").fill(accounts[0]!.username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Abc12345");
  await page.getByRole("button", { name: "Vào lớp" }).click();

  await expect(page.getByRole("heading", { name: "Đặt mật khẩu riêng" })).toBeVisible();
  // They have just typed Abc12345; it isn't asked again, and it can't be chosen.
  await expect(page.getByLabel("Mật khẩu hiện tại")).toHaveCount(0);
  // Not even with different capitals.
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("abc12345");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("abc12345");
  await page.getByRole("button", { name: "Lưu và vào lớp" }).click();
  await expect(page.getByText(/chọn một mật khẩu khác Abc12345/)).toBeVisible();

  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("nha-an-2016");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("nha-an-2016");
  await page.getByRole("button", { name: "Lưu và vào lớp" }).click();
  await expect(page).toHaveURL(/\/hoc-sinh\/$/);
  check();
});

test("Tạo lại tài khoản cả lớp theo mẫu moves an old class onto the pattern", async ({ page }) => {
  const check = watchConsole(page);
  const { classId, accounts } = await apiClassroom(page.request, ["Trần Hoài An"]);
  // Give the child a birthday the way she would, in Hồ sơ Măng non.
  expect((await page.request.patch(`/api/t/students/${accounts[0]!.id}/profile`, { data: { birthday: "2016-11-22" } })).status()).toBe(200);
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=tai-khoan`);
  await page.getByRole("button", { name: /Tạo lại tài khoản cả lớp theo mẫu/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tạo lại tài khoản" }).click();
  await expect(page.getByText("Đã tạo lại tài khoản cả lớp.")).toBeVisible();
  const row = page.locator("tbody tr").first();
  await expect(row).toContainText(/hoaian22[a-z]*/);
  await expect(row).toContainText("Abc12345");
  check();
});
