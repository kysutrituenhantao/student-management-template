import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

/**
 * Brief 10, 24 September 2026: "Chỉnh sửa giao diện mỗi nhiệm vụ là 1 tờ giấy note có đính đinh ghim. Hình thức đẹp,
 * dễ thương phù hợp với học sinh".
 */

const TASKS = ["Thứ Hai ngày 21/9/2026", "Thứ Ba ngày 22/9/2026", "Thứ Tư ngày 23/9/2026", "Thứ Năm ngày 24/9/2026"];

test("every task is a sticky note with a pushpin, hanging straight, for her and for the family", async ({ browser }) => {
  const tc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai"]);
  for (const title of TASKS) await t.request.post(`/api/t/classes/${classId}/tasks`, { data: { title, instructions: "Toán: bài 1 trang 46." } });

  for (const [page, path] of [[t, `/giao-vien/lop/?id=${classId}&tab=nhiem-vu`]] as const) {
    await page.goto(path);
    const notes = page.getByRole("list", { name: "Các nhiệm vụ" }).getByRole("listitem");
    await expect(notes).toHaveCount(TASKS.length);
    // One pin a note, sitting on its top edge, and the pins are not all one colour.
    const pins = notes.locator(".task-pin");
    await expect(pins).toHaveCount(TASKS.length);
    const geo = await notes.evaluateAll((els) =>
      els.map((e) => {
        const pin = e.querySelector(".task-pin")!.getBoundingClientRect();
        const note = e.getBoundingClientRect();
        return {
          pinCentre: pin.top + pin.height / 2,
          noteTop: note.top,
          pinColour: getComputedStyle(e.querySelector(".task-pin")!).color,
          transform: getComputedStyle(e).transform,
        };
      }),
    );
    for (const g of geo) expect(Math.abs(g.pinCentre - g.noteTop)).toBeLessThan(24);
    expect(new Set(geo.map((g) => g.pinColour)).size).toBeGreaterThan(1);
    // Straight: "các trang giấy note được đặt thẳng k để nghiêng" (brief 12 took back the tilt).
    for (const g of geo) expect(g.transform).toBe("none");
    // Her pencil and bin are still on every note, and still work.
    await expect(notes.first().getByRole("button", { name: /^Sửa / })).toBeVisible();
  }
  check();

  const fc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const f = await fc.newPage();
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=nhiem-vu");
  const theirs = f.getByRole("list", { name: "Các nhiệm vụ" }).getByRole("listitem");
  await expect(theirs).toHaveCount(TASKS.length);
  await expect(theirs.locator(".task-pin")).toHaveCount(TASKS.length);
  // A tilted note never pushes the phone's page sideways.
  const overflow = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await tc.close();
  await fc.close();
});
