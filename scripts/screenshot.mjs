#!/usr/bin/env node
/**
 * Look at the app the way she will.
 *
 * She has no localhost: she only ever sees production, on a laptop or a phone. So before anything ships, someone
 * has to actually look at it — half of what she reports is invisible to a test (a button the colour of its
 * background, text off the edge of a phone, an icon too small to read across a classroom).
 *
 * This drives the local stack through the real UI and writes screenshots at 1440px and at a 390px phone.
 *
 *   npm run stack:up
 *   node scripts/screenshot.mjs                 # → .screenshots/
 *   node scripts/screenshot.mjs --out /tmp/shots --only teacher
 *
 * The class it creates is invented — never real children (see CLAUDE.md, "Rules that protect the children's data").
 */
import { mkdir, rm } from "node:fs/promises";
import { chromium } from "playwright";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", process.env.BASE_URL ?? "http://localhost:8080");
const OUT = arg("out", ".screenshots");
const ONLY = arg("only", "all");
const INVITE = process.env.TEACHER_INVITE_CODE ?? "lop-hoc-hanh-phuc-local";

/** Invented, and obviously so. */
const CLASS_NAME = "Lớp 4X (ảnh chụp thử)";
const CHILDREN = [
  "Trần Khánh Vy", "Nguyễn Gia Bảo", "Lê Thanh Trúc", "Phạm Đức Anh", "Võ Hoàng Long",
  "Đặng Bảo Ngân", "Bùi Nhật Minh", "Hoàng Tuệ Lâm", "Đỗ Hải Yến", "Ngô Quang Vinh",
  "Dương Mai Chi", "Lý Trọng Nhân",
];
/** A spread wide enough that several stages of plant are on screen at once. */
const DROPS = [23, 210, 3, 58, 105, 360, 12, 520, 305, 0, 140, 45];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch().catch((e) => {
    throw new Error(
      `Không mở được Chromium (${e.message}).\nCài trình duyệt cho Playwright trước: npx playwright install chromium`,
    );
  });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2, baseURL: BASE });
  const page = await desktop.newPage();

  const api = async (path, data) => {
    const res = await page.request.fetch(BASE + path, { method: "POST", data, headers: { "content-type": "application/json" } });
    if (!res.ok()) throw new Error(`${path} → ${res.status()} ${await res.text()}`);
    return res.json();
  };

  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  await api("/api/auth/teacher/register", { inviteCode: INVITE, username: `anh${tag}`, displayName: "Cô Hạnh", password: "mat-khau-cua-co" });
  const cls = await api("/api/t/classes", { name: CLASS_NAME, grade: 4, schoolYear: "2026-2027" });
  const accounts = await api(`/api/t/classes/${cls.id}/students`, {
    students: CHILDREN.map((fullName, i) => ({ fullName, group: (i % 4) + 1 })),
  });
  // Points are capped at 20 a go, as they are in class.
  for (const [i, account] of accounts.entries()) {
    for (let left = DROPS[i] ?? 0; left > 0; left -= 20) {
      await api(`/api/t/classes/${cls.id}/points`, { studentIds: [account.id], delta: Math.min(20, left) });
    }
  }
  for (const post of [
    { kind: "hoat_dong", title: "Tiết Mỹ thuật: vẽ mùa thu", body: "Tranh của cả lớp đã dán lên bảng.", color: "vang", sticker: "🎨", layout: "ghim" },
    { kind: "viec_nha", title: "Đọc trước bài Cây tre", body: "Đọc 2 lần và gạch chân từ khó.", color: "bac_ha", sticker: "📚", layout: "khung" },
    { kind: "loi_nhan", title: "Thứ sáu mặc đồng phục thể dục", body: "Các con nhớ mang thêm nước nhé.", color: "xanh", sticker: "📣", layout: "bang" },
    { kind: "hoat_dong", title: "Hội chợ xuân của lớp", body: "Các con bán hàng gây quỹ, ai cũng khéo tay.", color: "hong", sticker: "🎉", layout: "nhan" },
  ]) {
    await api(`/api/t/classes/${cls.id}/posts`, post);
  }

  const shot = async (p, url, name, full = false) => {
    await p.goto(url);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    console.log(`  ${OUT}/${name}.png`);
  };

  if (ONLY !== "family") {
    console.log("Màn hình của cô (1440px):");
    for (const [tab, name] of [
      ["", "teacher-01-trang-chu"],
      ["&tab=bang-tin", "teacher-02-bang-tin"],
      ["&tab=nhiem-vu", "teacher-03-nhiem-vu"],
      ["&tab=ho-so", "teacher-04-ho-so"],
      ["&tab=tai-khoan", "teacher-05-tai-khoan"],
      ["&tab=chuyen-can", "teacher-06-chuyen-can"],
      ["&tab=to-so-do", "teacher-07-so-do-lop"],
      ["&tab=bao-cao", "teacher-08-bao-cao"],
      ["&tab=thi-dua", "teacher-09-thi-dua"],
      ["&tab=vinh-danh", "teacher-09b-vinh-danh"],
      ["&tab=doi-qua", "teacher-10-doi-thuong"],
      ["&tab=loi-nhan", "teacher-11-loi-nhan"],
    ]) {
      await shot(page, `/giao-vien/lop/?id=${cls.id}${tab}`, name);
    }
    // The picker, part-way through a duck race, because a still of it says more than the idle screen.
    await page.goto(`/giao-vien/lop/?id=${cls.id}`);
    await page.getByRole("button", { name: /Gọi ngẫu nhiên/ }).click();
    const pick = page.getByRole("dialog");
    await pick.getByRole("tab", { name: /Đua vịt/ }).click();
    await pick.getByRole("button", { name: /Bắt đầu đua/ }).click();
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/teacher-12-goi-ngau-nhien.png` });
    console.log(`  ${OUT}/teacher-12-goi-ngau-nhien.png`);
  }

  if (ONLY !== "teacher") {
    console.log("Màn hình của con và phụ huynh (390px):");
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, baseURL: BASE, isMobile: true, hasTouch: true });
    const f = await phone.newPage();
    await f.goto("/dang-nhap/");
    await f.getByLabel("Tên đăng nhập").fill(accounts[1].username);
    await f.getByLabel("Mật khẩu", { exact: true }).fill(accounts[1].password);
    await f.getByRole("button", { name: "Vào lớp" }).click();
    // A new account is on the class's shared Abc12345: the family chooses its own first (brief 6).
    await f.waitForURL(/hoc-sinh|doi-mat-khau/);
    if (f.url().includes("doi-mat-khau")) {
      await f.screenshot({ path: `${OUT}/family-00-dat-mat-khau.png` });
      await f.getByLabel("Mật khẩu mới", { exact: true }).fill("meo-con-123");
      await f.getByLabel("Nhập lại mật khẩu mới").fill("meo-con-123");
      await f.getByRole("button", { name: "Lưu và vào lớp" }).click();
      await f.waitForURL(/hoc-sinh/);
    }
    for (const [tab, name] of [
      ["", "family-01-trang-chu"],
      ["?tab=bang-tin", "family-02-bang-tin"],
      ["?tab=nhiem-vu", "family-03-nhiem-vu"],
      ["?tab=ket-qua", "family-04-ket-qua"],
      ["?tab=thi-dua", "family-05-thi-dua"],
      ["?tab=nhan-co", "family-06-nhan-co"],
      ["?tab=ho-so", "family-07-ho-so"],
    ]) {
      await shot(f, `/hoc-sinh/${tab}`, name, true);
    }
  }

  await browser.close();
  console.log(`\nXong. Mở thư mục ${OUT} để xem.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
