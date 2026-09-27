import { expect, test } from "@playwright/test";
import { apiClassroom, watchConsole } from "./helpers";

/**
 * Brief 7, 24 September 2026: "tiêu chí cộng điểm và trừ điểm… nằm trong phần Đổi thưởng… 3 tab: Đổi thưởng; Điểm
 * cộng; Điểm trừ… Ví dụ: Chăm chỉ cộng 2 giọt nước; Không làm BT trừ 2 giọt nước. Phần này liên kết sang phần thêm
 * điểm hoặc trừ điểm cho HS ở trang chủ. Vẫn giữ nguyên hiển thị ban đầu."
 */

test("Đổi thưởng has three little tabs, and Điểm cộng / Điểm trừ are hers to change", async ({ page }) => {
  const check = watchConsole(page);
  const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=doi-qua`);
  const subs = page.getByRole("tablist", { name: "Mục nhỏ" });
  await expect(subs.getByRole("tab")).toHaveText([/Đổi thưởng/, /Điểm cộng/, /Điểm trừ/]);

  // Điểm cộng: "Chăm chỉ cộng 2 giọt nước".
  await subs.getByRole("tab", { name: /Điểm cộng/ }).click();
  await expect(page).toHaveURL(/tab=diem-cong/);
  const plus = page.getByRole("list", { name: "Tiêu chí điểm cộng" });
  const hard = plus.getByRole("listitem").filter({ hasText: "Chăm chỉ" });
  await expect(hard).toContainText("+1 💧");
  await hard.getByRole("button", { name: "Sửa Chăm chỉ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Thêm một giọt" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
  await expect(hard).toContainText("+2 💧");

  // Điểm trừ: "Không làm BT trừ 2 giọt nước", added.
  await subs.getByRole("tab", { name: /Điểm trừ/ }).click();
  await page.getByRole("button", { name: /Thêm điểm trừ/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Tiêu chí").fill("Không làm BT");
  await sheet.getByLabel("Số giọt nước").fill("2");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  const minus = page.getByRole("list", { name: "Tiêu chí điểm trừ" });
  await expect(minus.getByRole("listitem").filter({ hasText: "Không làm BT" })).toContainText("−2 💧");

  // And one she doesn't want any more.
  await minus.getByRole("button", { name: "Xoá Quên đồ dùng" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Xoá", exact: true }).click();
  await expect(minus.getByText("Quên đồ dùng")).toHaveCount(0);
  check();
});

test("on Trang chủ, a criterion gives exactly its drops in one tap, and the sheet looks as it did", async ({ page }) => {
  const check = watchConsole(page);
  const { classId } = await apiClassroom(page.request, ["Nguyễn Thị Mai"]);
  const reasons = (await (await page.request.get(`/api/t/classes/${classId}/reasons`)).json()) as { id: number; label: string; drops: number }[];
  const hard = reasons.find((r) => r.label === "Chăm chỉ")!;
  await page.request.patch(`/api/t/reasons/${hard.id}`, { data: { ...hard, drops: 2 } });
  await page.request.post(`/api/t/classes/${classId}/reasons`, {
    data: { label: "Không làm BT", emoji: "📝", category: "hoc_tap", kind: "minus", drops: 2 },
  });

  await page.goto(`/giao-vien/lop/?id=${classId}`);
  await page.getByRole("button", { name: /Nguyễn Thị Mai có 0 giọt nước/ }).click();
  const sheet = page.getByRole("dialog");
  // The amounts are still there, below the criteria.
  await expect(sheet.getByRole("button", { name: "+10 💧" })).toBeVisible();
  await sheet.getByRole("button", { name: /Chăm chỉ \+2 💧/ }).click();
  await expect(page.getByRole("button", { name: /Nguyễn Thị Mai có 2 giọt nước/ })).toBeVisible();

  await page.getByRole("button", { name: /Nguyễn Thị Mai có 2 giọt nước/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Không làm BT −2 💧/ }).click();
  await expect(page.getByRole("button", { name: /Nguyễn Thị Mai có 0 giọt nước/ })).toBeVisible();

  await page.getByRole("button", { name: /Lịch sử/ }).click();
  const history = page.getByRole("dialog");
  await expect(history.getByText("Chăm chỉ")).toBeVisible();
  await expect(history.getByText("Không làm BT")).toBeVisible();
  check();
});
