import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, watchConsole } from "./helpers";

test("bảng tin: the teacher pins a theme and a note, the family hearts it and writes back", async ({ browser }) => {
  const teacherCtx = await browser.newContext();
  const t = await teacherCtx.newPage();
  const checkTeacher = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  const mai = accounts[0]!;

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=bang-tin`);

  // The month's chủ điểm.
  await t.getByRole("button", { name: /Chủ đề tháng/ }).click();
  const theme = t.getByRole("dialog");
  await theme.getByLabel("Chủ đề của tháng").fill("Vui hội trăng rằm");
  await theme.getByLabel("Ghi chú thêm").fill("Thứ sáu lớp mình rước đèn.");
  await theme.getByRole("button", { name: "Lưu chủ đề" }).click();
  await expect(t.getByRole("heading", { name: /Vui hội trăng rằm/ })).toBeVisible();

  // A note on the wall.
  await t.getByRole("button", { name: /Thêm ô tin/ }).click();
  const sheet = t.getByRole("dialog");
  await sheet.getByRole("button", { name: /Việc ở nhà/ }).click();
  await sheet.getByLabel("Tiêu đề").fill("Ôn bảng nhân 8");
  await sheet.getByLabel("Nội dung").fill("Mỗi con đọc thuộc bảng nhân 8 nhé.");
  await sheet.getByRole("button", { name: "Đăng lên bảng" }).click();
  await expect(t.getByRole("heading", { name: "Ôn bảng nhân 8" })).toBeVisible();

  // The family reads it from the child's account.
  const familyCtx = await browser.newContext();
  const f = await familyCtx.newPage();
  const checkFamily = watchConsole(f);
  await studentLogin(f, mai);
  await f.goto("/hoc-sinh/?tab=bang-tin");
  await expect(f.getByRole("heading", { name: /Vui hội trăng rằm/ })).toBeVisible();
  await expect(f.getByRole("heading", { name: "Ôn bảng nhân 8" })).toBeVisible();

  // A heart, counted once however often it is tapped.
  const heart = f.getByRole("button", { name: "Thích Ôn bảng nhân 8" });
  await heart.click();
  await expect(f.getByRole("button", { name: "Bỏ thích Ôn bảng nhân 8" })).toContainText("1");

  // And a word back to the teacher.
  await f.getByRole("button", { name: /Bình luận/ }).click();
  const comments = f.getByRole("dialog");
  await comments.getByLabel("Viết cho cô và cả lớp").fill("Dạ vâng, tối nay cháu sẽ ôn ạ.");
  await comments.getByRole("button", { name: "Gửi" }).click();
  await expect(comments.getByText("Dạ vâng, tối nay cháu sẽ ôn ạ.")).toBeVisible();
  await expect(comments.getByText("Phụ huynh Nguyễn Thị Mai")).toBeVisible();
  await comments.getByRole("button", { name: "Đóng" }).click();

  // The teacher sees the heart and the comment, and answers.
  await t.reload();
  await expect(t.getByRole("heading", { name: "Ôn bảng nhân 8" })).toBeVisible();
  await t.getByRole("button", { name: /^1$/ }).first().click();
  const thread = t.getByRole("dialog");
  await expect(thread.getByText("Dạ vâng, tối nay cháu sẽ ôn ạ.")).toBeVisible();
  await thread.getByLabel("Trả lời phụ huynh").fill("Cảm ơn chị ạ.");
  await thread.getByRole("button", { name: "Gửi" }).click();
  await expect(thread.getByText("Cảm ơn chị ạ.")).toBeVisible();
  await thread.getByRole("button", { name: "Đóng" }).click();

  checkTeacher();
  checkFamily();
  await teacherCtx.close();
  await familyCtx.close();
});
