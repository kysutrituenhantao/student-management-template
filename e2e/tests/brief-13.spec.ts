import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/**
 * Brief 13, 25 September 2026: "khi nhấn vào bài viết có thể xem được HS nào like hay bình luận bài", and in Chuyên
 * cần "chế độ chọn cá nhân hoặc chọn nhiều… Cuối trang có phần điểm danh những HS đã chọn theo tiêu chí".
 */

test("Bảng tin: she taps a tile and sees which children hearted it and who wrote what", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai", "Trần Văn Tùng", "Lê Bảo An"]);
  const post = (await (await t.request.post(`/api/t/classes/${classId}/posts`, { data: { kind: "hoat_dong", title: "Vui Tết Trung thu" } })).json()) as { id: number };

  for (const [i, comment] of [[0, "Con vui lắm cô ơi!"], [1, null]] as const) {
    const fc = await browser.newContext();
    const f = await fc.newPage();
    await studentLogin(f, accounts[i]!);
    await f.request.post(`/api/s/posts/${post.id}/like`, { data: {} });
    if (comment) await f.request.post(`/api/s/posts/${post.id}/comments`, { data: { body: comment } });
    await fc.close();
  }

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=bang-tin`);
  await t.getByRole("button", { name: "Xem ai đã thích và bình luận: Vui Tết Trung thu" }).click();
  const sheet = t.getByRole("dialog", { name: /Vui Tết Trung thu/ });
  const liked = sheet.getByRole("list", { name: "Đã thích" }).getByRole("listitem");
  await expect(liked).toHaveText([/Nguyễn Thị Mai/, /Trần Văn Tùng/]);
  const said = sheet.getByRole("list", { name: "Đã bình luận" }).getByRole("listitem");
  await expect(said).toHaveCount(1);
  await expect(said.first()).toContainText("Nguyễn Thị Mai");
  await expect(said.first()).toContainText("Con vui lắm cô ơi!");
  await sheet.getByRole("button", { name: "Đóng" }).click();

  // The heart count opens the same.
  await t.getByRole("button", { name: /2 lượt thích/ }).click();
  await expect(t.getByRole("dialog", { name: /Vui Tết Trung thu/ })).toBeVisible();
  check();
  await tc.close();
});

test("Chuyên cần: she picks several children and marks them all at once from the bar at the bottom", async ({ page }) => {
  const check = watchConsole(page);
  const names = ["Nguyễn Thị Mai", "Trần Văn Tùng", "Lê Bảo An", "Phạm Gia Hân"];
  const { classId } = await apiClassroom(page.request, names);
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=chuyen-can`);

  // Everyone present first, the way she starts the day.
  await page.getByRole("button", { name: /Cả lớp có mặt/ }).click();
  await expect(page.getByText(/Đã điểm danh 4\/4 bạn/)).toBeVisible();

  // Then "chọn nhiều": two late ones, in one go.
  await page.getByRole("tab", { name: /Chọn nhiều bạn/ }).click();
  await page.getByRole("button", { name: "Chọn Trần Văn Tùng" }).click();
  await page.getByRole("button", { name: "Chọn Phạm Gia Hân" }).click();
  const bar = page.getByRole("region", { name: "Điểm danh các bạn đã chọn" });
  await expect(bar).toContainText("Đã chọn 2 bạn");
  await expect(bar).toBeInViewport();
  await bar.getByRole("button", { name: /Đi muộn/ }).click();
  await expect(page.getByText(/Đã điểm danh 2 bạn: Đi muộn/)).toBeVisible();
  // The choice is cleared once it is used.
  await expect(bar).toHaveCount(0);

  // And one with leave, with the reason.
  await page.getByRole("button", { name: "Chọn Lê Bảo An" }).click();
  await bar.getByLabel("Lý do (không bắt buộc)").fill("Con bị sốt");
  await bar.getByRole("button", { name: /Nghỉ có phép/ }).click();
  await expect(page.getByText(/Đã điểm danh 1 bạn: Nghỉ có phép/)).toBeVisible();

  // The screen says so at once; the save lands a moment later. Wait for it rather than race it.
  await expect(page.getByText(/Đã điểm danh 4\/4 bạn/)).toBeVisible();
  const ids = (await (await page.request.get(`/api/t/classes/${classId}`)).json()) as { students: { id: number; fullName: string }[] };
  const byName = new Map(ids.students.map((s) => [s.fullName, s.id]));
  const saved = async () => {
    const view = (await (await page.request.get(`/api/t/classes/${classId}/attendance`)).json()) as {
      marks: { studentId: number; status: string; note: string }[];
    };
    const of = (n: string) => view.marks.find((m) => m.studentId === byName.get(n));
    return [of("Nguyễn Thị Mai")?.status, of("Trần Văn Tùng")?.status, of("Phạm Gia Hân")?.status, of("Lê Bảo An")?.status, of("Lê Bảo An")?.note];
  };
  await expect.poll(saved).toEqual(["co_mat", "di_muon", "di_muon", "co_phep", "Con bị sốt"]);

  // "Từng bạn" is still there, as before.
  await page.getByRole("tab", { name: /Từng bạn/ }).click();
  await page.getByRole("button", { name: "Đánh dấu Nguyễn Thị Mai đi muộn" }).click();
  await expect(page.getByRole("button", { name: "Đánh dấu Nguyễn Thị Mai đi muộn" })).toHaveAttribute("aria-pressed", "true");
  check();
});
