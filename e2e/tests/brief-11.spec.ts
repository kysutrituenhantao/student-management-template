import { expect, test, type Page } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/**
 * Brief 11, 24 September 2026: "Dù nhiệm vụ dài hay ngắn, chỉ hiển thị như ô thứ 3, nếu dài quá thì chấm ba chấm, HS
 * và PH có thể chọn vào nhiệm vụ để xem đầy đủ."
 */

const LONG = [
  "-Chuẩn bị cho hoạt động \"Vui Trung Thu\", mỗi học sinh chuẩn bị 1 đèn lồng hoặc đèn ông sao.",
  "-Tập hát bài: Chiếc đèn ông sao",
  "Bài tập:",
  "Toán: Tính giá trị biểu thức: a + b x 6",
  "a) Với a = 2 345 và b = 4 109",
  "b) Với a = 6 175 và b = 1 153",
  "Tiếng Việt: Gạch chân các danh từ trong đoạn văn sau:",
  "Tiếng đàn bay ra vườn. Vài cánh ngọc lan êm ái rụng xuống nền đất mát rượi. Dưới đường, lũ trẻ đang rủ nhau thả những chiếc thuyền giấy.",
  "CÂU CUỐI CÙNG CỦA BÀI.",
].join("\n");
const SHORT = "Bố mẹ sắp xếp dự họp lúc 7g30 thứ Bảy.";

/** A due date that is always still to come, so the family sees the task under "Cần làm" whatever day the test runs. */
const nextWeek = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

async function sameSquares(page: Page) {
  const notes = page.getByRole("list", { name: "Các nhiệm vụ" }).getByRole("listitem");
  await expect(notes).toHaveCount(2);
  const sizes = await notes.evaluateAll((els) =>
    els.map((e) => {
      const paper = e.querySelector(".task-tile") as HTMLElement;
      return { w: paper.offsetWidth, h: paper.offsetHeight };
    }),
  );
  // "Chỉ hiển thị như ô thứ 3": the long one is no taller than the short one, and both are square.
  expect(Math.abs(sizes[0]!.h - sizes[1]!.h)).toBeLessThanOrEqual(1);
  for (const s of sizes) expect(Math.abs(s.h - s.w)).toBeLessThanOrEqual(2);
  // The long one stops with "…": its text is cut to the lines the note has room for.
  const long = notes.filter({ hasText: "Thứ Năm ngày 24/9/2026" });
  const clamped = await long.locator(".task-body").evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(clamped).toBe(true);
  // Tapping the note opens it whole.
  await long.getByRole("button", { name: /Xem đầy đủ: Thứ Năm ngày 24\/9\/2026/ }).click();
  const whole = page.getByRole("dialog", { name: "Thứ Năm ngày 24/9/2026" });
  await expect(whole.getByText("CÂU CUỐI CÙNG CỦA BÀI.")).toBeVisible();
  await whole.getByRole("button", { name: "Đóng" }).first().click();
  await expect(whole).toBeHidden();
}

test("long or short, every note is the same square; a long one ends in … and opens whole", async ({ browser }) => {
  const tc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai"]);
  await t.request.post(`/api/t/classes/${classId}/tasks`, { data: { title: "Họp phụ huynh", instructions: SHORT } });
  await t.request.post(`/api/t/classes/${classId}/tasks`, { data: { title: "Thứ Năm ngày 24/9/2026", instructions: LONG, dueDate: nextWeek() } });

  // Her side: the same, and her pencil still edits rather than opening the note.
  await t.goto(`/giao-vien/lop/?id=${classId}&tab=nhiem-vu`);
  await sameSquares(t);
  await t.getByRole("button", { name: "Sửa Thứ Năm ngày 24/9/2026" }).click();
  await expect(t.getByRole("dialog", { name: "Sửa nhiệm vụ" })).toBeVisible();
  check();

  // The family, on a phone.
  const fc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const f = await fc.newPage();
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=nhiem-vu");
  await sameSquares(f);
  await tc.close();
  await fc.close();
});
