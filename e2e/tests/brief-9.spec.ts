import { expect, test, type Locator } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/**
 * Brief 9, 24 September 2026: "Bỏ phân môn. K cần hiển thị các phân môn. Các ô nhiệm vụ được sắp xếp theo bố cục ô
 * vuông như Padlet, tự động thay đổi màu chọn gam màu pastel nhẹ nhàng".
 */

const TASKS = [
  { title: "Thứ Năm ngày 24/9/2026", instructions: "Toán: bài 1, 2 trang 46.\nTiếng Việt: đọc bài Chú đất Nung." },
  { title: "Thứ Sáu ngày 25/9/2026", instructions: "Ôn bảng nhân 8." },
  { title: "Chuẩn bị Trung thu", instructions: "Mỗi bạn mang một chiếc đèn lồng nhỏ." },
];

/** Every tile: square or taller, several to a row, and no two neighbours the same colour. */
async function looksLikePadlet(tiles: Locator, perRow: number) {
  await expect(tiles).toHaveCount(TASKS.length);
  // Layout boxes, not screen boxes: since brief 10 each note is tilted a little, which moves its screen box.
  const boxes = await tiles.evaluateAll((els) =>
    els.map((e) => {
      const el = e as HTMLElement;
      // The paper is inside the note since brief 10; the note carries the pin and the tilt.
      const paper = e.querySelector(".task-tile") ?? e;
      return { top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight, bg: getComputedStyle(paper).backgroundColor };
    }),
  );
  for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(b.width - 1);
  expect(new Set(boxes.slice(0, perRow).map((b) => Math.round(b.top))).size).toBe(1);
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.bg).not.toBe(boxes[i - 1]!.bg);
  // Pastel: light, never white.
  for (const b of boxes) {
    const [r, g, bl] = b.bg.match(/\d+/g)!.map(Number);
    expect(Math.min(r!, g!, bl!)).toBeGreaterThan(170);
    expect(r! + g! + bl!).toBeLessThan(765);
  }
}

test("Nhiệm vụ has no subjects, and the tasks are square pastel tiles — for her and for the family", async ({ browser }) => {
  const tc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai"]);
  for (const task of TASKS) await t.request.post(`/api/t/classes/${classId}/tasks`, { data: task });

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=nhiem-vu`);
  await expect(t.getByRole("tablist", { name: "Lọc theo môn" })).toHaveCount(0);
  await expect(t.getByText(/Tất cả môn|Môn khác/)).toHaveCount(0);
  const tiles = t.getByRole("list", { name: "Các nhiệm vụ" }).getByRole("listitem");
  await looksLikePadlet(tiles, 3);
  await expect(tiles.first()).toContainText("Chuẩn bị Trung thu");

  // The editor asks no subject.
  await t.getByRole("button", { name: /Giao nhiệm vụ mới/ }).click();
  const editor = t.getByRole("dialog");
  await expect(editor.getByText("Môn học")).toHaveCount(0);
  await expect(editor.getByRole("button", { name: /Toán|Tiếng Việt/ })).toHaveCount(0);
  await editor.getByRole("button", { name: /Đóng|Thôi/ }).first().click();
  check();

  const fc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const f = await fc.newPage();
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=nhiem-vu");
  const theirs = f.getByRole("list", { name: "Các nhiệm vụ" }).getByRole("listitem");
  await looksLikePadlet(theirs, 2);
  await expect(f.getByText(/Môn khác|^Toán$|^Tiếng Việt$/)).toHaveCount(0);
  const overflow = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await tc.close();
  await fc.close();
});
