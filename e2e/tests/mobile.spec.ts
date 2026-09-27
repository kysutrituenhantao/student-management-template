import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin } from "./helpers";

test("the family's pages fit a phone: no sideways scroll, bottom navigation works", async ({ page }) => {
  const { accounts } = await apiClassroom(page.request, ["Phùng Khánh Linh"]);
  await page.request.post("/api/auth/logout", { data: {} });
  await studentLogin(page, accounts[0]!);
  for (const tab of ["", "?tab=bang-tin", "?tab=nhiem-vu", "?tab=ket-qua", "?tab=ho-so", "?tab=thi-dua", "?tab=huy-hieu", "?tab=nhan-co", "?tab=tai-khoan"]) {
    await page.goto(`/hoc-sinh/${tab}`);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, tab || "home").toBeLessThanOrEqual(0);
  }
  await page.goto("/hoc-sinh/");
  // Huy hiệu became Thi đua (brief 12); the child's badges are its third little tab.
  await page.getByRole("navigation").last().getByRole("button", { name: /^Thi đua$/ }).click();
  await expect(page.getByRole("heading", { name: /Thi đua/ })).toBeVisible();
});

test("the sign-in pages fit a phone", async ({ page }) => {
  for (const path of ["/", "/dang-nhap/", "/giao-vien/", "/giao-vien/dang-ky/"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test.describe("at 360px, the narrowest common phone", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("a classmate's long name in the Top 10 doesn't push the family's page sideways", async ({ page }) => {
    const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Hoàng Bảo Ngọc Anh Thư", "Lê Văn Tí"]);
    await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[0]!.id], delta: 5 } });
    await page.request.post("/api/auth/logout", { data: {} });
    await studentLogin(page, accounts[1]!);
    await expect(page.getByText("Top 10 tuần này")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("navigation").last().getByRole("button", { name: /Nhiệm vụ/ }).click();
    await expect(page.getByRole("heading", { name: "📚 Nhiệm vụ" })).toBeVisible();
  });

  test("the teacher's tabs fit a phone too", async ({ page }) => {
    const { classId, accounts } = await apiClassroom(page.request, ["Nguyễn Hoàng Bảo Ngọc Anh Thư", "Lê Văn Tí"]);
    await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[0]!.id], delta: 5 } });
    for (const tab of [
      "",
      "&tab=bang-tin",
      "&tab=nhiem-vu",
      "&tab=tai-khoan",
      "&tab=ho-so",
      "&tab=chuyen-can",
      "&tab=thi-dua",
      "&tab=vinh-danh",
      "&tab=bao-cao",
      "&tab=to-so-do",
      "&tab=doi-qua",
      "&tab=huy-hieu",
      "&tab=loi-nhan",
      "&tab=cai-dat",
    ]) {
      await page.goto(`/giao-vien/lop/?id=${classId}${tab}`);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, tab || "home").toBeLessThanOrEqual(0);
    }
  });
});
