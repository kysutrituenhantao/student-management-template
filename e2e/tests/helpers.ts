import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const INVITE = process.env.TEACHER_INVITE_CODE ?? "lop-hoc-hanh-phuc-local";
export const TEACHER_PASSWORD = "mat-khau-cua-co";

/** Unique per run, so specs never collide in the shared database. */
export const tag = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** Fails the test on uncaught page errors and console errors. */
export function watchConsole(page: Page, allow: RegExp[] = []) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (allow.some((re) => re.test(text))) return;
    problems.push(`console: ${text}`);
  });
  return () => expect(problems, problems.join("\n")).toEqual([]);
}

/** Registers a teacher through the page, and leaves the browser signed in. */
export async function registerTeacher(page: Page, username = `co${tag()}`) {
  await page.goto("/giao-vien/dang-ky/");
  await page.getByLabel("Mã mời").fill(INVITE);
  await page.getByLabel("Tên hiển thị").fill("Cô Hạnh");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Các lớp của tôi" })).toBeVisible();
  return username;
}

/** A teacher, a class and students, made through the API (the UI flows have their own specs). */
export async function apiClassroom(request: APIRequestContext, names: string[]) {
  const username = `co${tag()}`;
  const reg = await request.post("/api/auth/teacher/register", {
    data: { inviteCode: INVITE, username, displayName: "Cô Hạnh", password: TEACHER_PASSWORD },
  });
  expect(reg.status(), await reg.text()).toBe(201);
  const cls = await request.post("/api/t/classes", { data: { name: `Lớp 4B ${tag()}`, grade: 4, schoolYear: "2026-2027" } });
  expect(cls.status()).toBe(201);
  const { id } = (await cls.json()) as { id: number };
  const added = await request.post(`/api/t/classes/${id}/students`, {
    data: { students: names.map((fullName, i) => ({ fullName, group: (i % 2) + 1 })) },
  });
  expect(added.status(), await added.text()).toBe(201);
  const accounts = (await added.json()) as Account[];
  return { username, classId: id, accounts };
}

export interface Account {
  id: number;
  fullName: string;
  username: string;
  password: string;
  group: number;
}

/**
 * Signs a child in with the account the teacher handed out. On the class's shared Abc12345 the family chooses its
 * own password first (brief 6); this does it the way a family would and writes it back into `account`.
 */
export async function studentLogin(page: Page, account: Account) {
  await page.goto("/dang-nhap/");
  await page.getByLabel("Tên đăng nhập").fill(account.username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Vào lớp" }).click();
  await expect(page).toHaveURL(/\/(hoc-sinh|doi-mat-khau)\//);
  if (page.url().includes("/doi-mat-khau/")) {
    const chosen = `rieng-${account.username}`;
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill(chosen);
    await page.getByLabel("Nhập lại mật khẩu mới").fill(chosen);
    await page.getByRole("button", { name: "Lưu và vào lớp" }).click();
    account.password = chosen;
  }
  await expect(page).toHaveURL(/\/hoc-sinh\/$/);
}
