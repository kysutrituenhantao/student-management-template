import { expect, test } from "@playwright/test";
import { apiClassroom, studentLogin, tag, TEACHER_PASSWORD, watchConsole } from "./helpers";

test("nhiệm vụ: the teacher gives work, the family reads exactly what she wrote", async ({ browser }) => {
  const teacherCtx = await browser.newContext();
  const t = await teacherCtx.newPage();
  const checkTeacher = watchConsole(t);
  const { username, classId, accounts } = await apiClassroom(t.request, ["Nguyễn Thị Mai", "Trần Văn Tùng"]);
  const mai = accounts[0]!;

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=nhiem-vu`);
  await t.getByRole("button", { name: /Giao nhiệm vụ mới/ }).first().click();
  const editor = t.getByRole("dialog");
  await editor.getByLabel("Tên nhiệm vụ").fill("Bảng nhân 8");
  await editor.getByLabel("Nội dung cô giao").fill("Học thuộc bảng nhân 8. Làm bài 1, 2 trang 46 vào vở ô li.");
  await editor.getByRole("button", { name: "Giao cho cả lớp" }).click();
  await expect(t.getByText("Đã giao cho cả lớp.")).toBeVisible();

  // A second one. There are no subjects to choose (brief 9).
  await t.getByRole("button", { name: /Giao nhiệm vụ mới/ }).first().click();
  await editor.getByLabel("Tên nhiệm vụ").fill("Tả con vật em yêu");
  await editor.getByLabel("Nội dung cô giao").fill("Viết 5 câu tả con vật nuôi trong nhà.");
  await editor.getByRole("button", { name: "Giao cho cả lớp" }).click();
  await expect(t.locator("li", { hasText: "Tả con vật em yêu" })).toBeVisible();

  // The family, on a phone. Typed the way a tired parent would: capitals, a space where the dot is.
  const familyCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const f = await familyCtx.newPage();
  const checkFamily = watchConsole(f);
  await studentLogin(f, { ...mai, username: mai.username.toUpperCase().replace(".", " ") });
  await expect(f.getByText("Chào Mai!")).toBeVisible();
  // The whole notice is on the home screen: nothing to open, nothing to send back.
  await expect(f.getByText("Học thuộc bảng nhân 8. Làm bài 1, 2 trang 46 vào vở ô li.")).toBeVisible();

  await f.goto("/hoc-sinh/?tab=nhiem-vu");
  await expect(f.getByRole("heading", { name: "📚 Nhiệm vụ" })).toBeVisible();
  await expect(f.getByText("Viết 5 câu tả con vật nuôi trong nhà.")).toBeVisible();
  await expect(f.getByRole("button", { name: "Nộp bài" })).toHaveCount(0);
  await expect(f.getByRole("link", { name: /Bảng nhân 8/ })).toHaveCount(0);

  // She corrects herself, and the family sees the correction.
  await t.getByRole("button", { name: "Sửa Tả con vật em yêu" }).click();
  await editor.getByLabel("Nội dung cô giao").fill("Viết 7 câu tả con vật nuôi trong nhà.");
  await editor.getByRole("button", { name: "Lưu và giao" }).click();
  await f.reload();
  await expect(f.getByText("Viết 7 câu tả con vật nuôi trong nhà.")).toBeVisible();

  checkTeacher();
  checkFamily();
  await teacherCtx.close();
  await familyCtx.close();
  void username;
  void TEACHER_PASSWORD;
});

test("messages: a family writes to the teacher, she answers, both see the thread", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const { classId, accounts } = await apiClassroom(t.request, ["Lê Hoàng Nam"]);
  const fc = await browser.newContext();
  const f = await fc.newPage();
  await studentLogin(f, accounts[0]!);
  await f.goto("/hoc-sinh/?tab=nhan-co");
  await f.getByLabel("Tin nhắn").fill("Thưa cô, mai con xin nghỉ học vì bị sốt ạ.");
  await f.getByRole("button", { name: "Gửi" }).click();
  await expect(f.getByText("Thưa cô, mai con xin nghỉ học vì bị sốt ạ.")).toBeVisible();

  await t.goto(`/giao-vien/lop/?id=${classId}`);
  await expect(t.getByRole("tab", { name: /Lời nhắn/ })).toContainText("1");
  await t.getByRole("tab", { name: /Lời nhắn/ }).click();
  await t.getByRole("button", { name: /Lê Hoàng Nam/ }).first().click();
  // The thread, not the one-line preview in the list beside it.
  const thread = t.getByRole("log");
  await expect(thread.getByText("Thưa cô, mai con xin nghỉ học vì bị sốt ạ.")).toBeVisible();
  await t.getByLabel("Tin nhắn").fill("Cô biết rồi. Con nghỉ ngơi cho khỏe nhé.");
  await t.getByRole("button", { name: "Gửi" }).click();
  await expect(thread.getByText("Cô biết rồi. Con nghỉ ngơi cho khỏe nhé.")).toBeVisible();

  await f.goto("/hoc-sinh/");
  await expect(f.getByText(/Cô có 1 tin nhắn mới/)).toBeVisible();
  await f.goto("/hoc-sinh/?tab=nhan-co");
  await expect(f.getByText("Cô biết rồi. Con nghỉ ngơi cho khỏe nhé.")).toBeVisible();

  // An announcement for the whole class.
  await t.goto(`/giao-vien/lop/?id=${classId}&tab=loi-nhan`);
  await t.getByLabel("Tiêu đề").fill("Họp phụ huynh cuối tháng");
  await t.getByRole("button", { name: "Đăng thông báo" }).click();
  await f.goto("/hoc-sinh/");
  await expect(f.getByText("Họp phụ huynh cuối tháng")).toBeVisible();
  await tc.close();
  await fc.close();
});

test("đổi thưởng: the teacher hands a reward over, the plant keeps its size, the family has no shop", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const check = watchConsole(t);
  const { classId, accounts } = await apiClassroom(t.request, ["Vũ Minh Khang"]);
  const khang = accounts[0]!;
  await t.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [khang.id], delta: 20 } });
  await t.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [khang.id], delta: 5 } });

  await t.goto(`/giao-vien/lop/?id=${classId}&tab=doi-qua`);
  await expect(t.getByRole("heading", { name: /Đổi thưởng/ })).toBeVisible();
  await t.getByRole("button", { name: "Trao quà", exact: true }).click();
  const sheet = t.getByRole("dialog");
  // The first real option after "Chọn…": the class has one child and the shop starts with the sticker.
  await sheet.getByLabel("Học sinh").selectOption({ index: 1 });
  await sheet.getByLabel("Phần quà").selectOption({ index: 1 });
  await sheet.getByRole("button", { name: /Trao quà và trừ giọt nước/ }).click();
  await expect(t.getByText(/Đã trao “Nhãn dán dễ thương” cho Vũ Minh Khang/)).toBeVisible();

  // "Nước mất đi k làm cây nhỏ lại": the 25 drops he earned still stand on his sticker.
  await t.goto(`/giao-vien/lop/?id=${classId}`);
  await expect(t.getByRole("button", { name: /Vũ Minh Khang có 25 giọt nước/ })).toBeVisible();

  // And the family is never offered the shop.
  const fc = await browser.newContext();
  const f = await fc.newPage();
  const checkFamily = watchConsole(f);
  await studentLogin(f, khang);
  await expect(f.getByText(/để đổi quà/)).toHaveCount(0);
  await expect(f.getByRole("button", { name: /^Quà$/ })).toHaveCount(0);
  await f.goto("/hoc-sinh/?tab=huy-hieu");
  await expect(f.getByRole("list", { name: "Huy hiệu của con" }).or(f.getByText(/chưa có huy hiệu/))).toBeVisible();

  check();
  checkFamily();
  await tc.close();
  await fc.close();
});

test("a forgotten password: the teacher reads it back, and can hand out a new one", async ({ browser }) => {
  const tc = await browser.newContext();
  const t = await tc.newPage();
  const { classId, accounts } = await apiClassroom(t.request, ["Hà Thu Trang"]);
  const trang = accounts[0]!;
  const fc = await browser.newContext();
  const f = await fc.newPage();
  await studentLogin(f, trang);
  await f.goto("/hoc-sinh/?tab=tai-khoan");
  await f.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(f).toHaveURL(/\/dang-nhap\/$/);

  // The parent asks on Zalo: the teacher reads the password off her own screen.
  await t.goto(`/giao-vien/lop/?id=${classId}&tab=tai-khoan`);
  await expect(t.getByText("••••••").first()).toBeVisible();
  await t.getByRole("button", { name: /Hiện mật khẩu/ }).click();
  await expect(t.getByText(trang.password).first()).toBeVisible();

  // And when she wants a fresh one, the old one stops working.
  await t.getByRole("button", { name: "Đặt lại mật khẩu cho Hà Thu Trang" }).click();
  await t.getByRole("dialog").getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await expect(t.getByText("Đã đặt lại mật khẩu cho Hà Thu Trang.")).toBeVisible();
  const fresh = (await t.getByRole("dialog").getByRole("definition").nth(1).textContent())!.trim();
  // Back to the class's first password; the family picks a new one of its own when it signs in.
  expect(fresh).toBe("Abc12345");
  expect(fresh).not.toBe(trang.password);

  await f.getByLabel("Tên đăng nhập").fill(trang.username);
  await f.getByLabel("Mật khẩu", { exact: true }).fill(trang.password);
  await f.getByRole("button", { name: "Vào lớp" }).click();
  await expect(f.getByText("Tên đăng nhập hoặc mật khẩu chưa đúng.")).toBeVisible();
  await studentLogin(f, { ...trang, password: fresh });
  await tc.close();
  await fc.close();
});

test("reports: week, month and semester views render with their charts", async ({ page }) => {
  const check = watchConsole(page);
  const { classId, accounts } = await apiClassroom(page.request, ["Đinh Bảo Châu", "Kiều Anh Quân"]);
  await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: accounts.map((a) => a.id), delta: 3 } });
  await page.request.post(`/api/t/classes/${classId}/points`, { data: { studentIds: [accounts[1]!.id], delta: -1 } });
  await page.goto(`/giao-vien/lop/?id=${classId}&tab=bao-cao`);
  await expect(page.locator("li", { hasText: "Giọt nước được cộng" })).toContainText("+6");
  await expect(page.locator("li", { hasText: "Giọt nước bị trừ" })).toContainText("−1");
  await expect(page.getByRole("img", { name: /Giọt nước theo từng ngày/ })).toBeVisible();
  await page.getByRole("tab", { name: "Tháng" }).click();
  await expect(page.getByRole("img", { name: /Giọt nước theo từng tuần/ })).toBeVisible();
  await page.getByRole("tab", { name: "Học kỳ" }).click();
  await expect(page.getByText(/Học kỳ I \(2026–2027\)|Học kỳ II \(2026–2027\)/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Tải file Excel/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^bao-cao-.*\.csv$/);
  check();
  void tag;
});

test("on a shared family phone, one child's thread with the teacher never reaches a sibling", async ({ page }) => {
  const { classId, accounts } = await apiClassroom(page.request, ["Đặng Gia Hân", "Đặng Gia Bảo"]);
  await page.request.post(`/api/t/students/${accounts[0]!.id}/messages`, { data: { body: "Riêng nhà Hân: cô nhắc con mang vở Toán." } });
  await page.request.post("/api/auth/logout", { data: {} });

  await studentLogin(page, accounts[0]!);
  await page.goto("/hoc-sinh/?tab=nhan-co");
  await expect(page.getByText("Riêng nhà Hân: cô nhắc con mang vở Toán.")).toBeVisible();
  await page.goto("/hoc-sinh/?tab=tai-khoan");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/dang-nhap\/$/);

  // The sibling signs in on the same phone.
  await studentLogin(page, accounts[1]!);
  await page.goto("/hoc-sinh/?tab=nhan-co");
  await expect(page.getByText("Chưa có tin nhắn nào.")).toBeVisible();
  void classId;
});
