/**
 * A sample class for the local stack: one teacher, a grade-4 class of 28, and three weeks of school life (drops,
 * tasks, remarks, rewards, messages), dated relative to today. Development only: the entrypoint applies it
 * when the database has no teacher yet, never in production.
 *
 *   npx tsx scripts/seed-demo.ts --out /tmp/demo.sql
 *
 * Sign in: teacher "codemo" / "demo-lop-hoc". Every child gets their own account ("anh.k7m4" / "k9mp42"); the
 * teacher's Học sinh tab lists them, and `npm run stack:accounts` prints a few.
 */
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  ATTENDANCE_EMOJI,
  ATTENDANCE_REASON,
  AVATAR_EMOJIS,
  DEFAULT_REASONS,
  DEFAULT_REWARDS,
  autoBadgeKeys,
  defaultSemesters,
  localDate,
  MONTH_THEMES,
  monthPeriod,
  normalizeUsername,
  CODE_ALPHABET,
  PASSWORD_LENGTH,
  USERNAME_CODE_LENGTH,
  usernameStem,
  weekPeriod,
  type PostKind,
} from "@lhhp/shared";
import { PBKDF2_ITERATIONS } from "../src/lib/password";

export const DEMO_TEACHER = { username: "codemo", password: "demo-lop-hoc", displayName: "Cô chủ nhiệm (lớp mẫu)" };

const NAMES = [
  "Nguyễn Minh Anh", "Trần Bảo Nam", "Lê Linh Đan", "Phạm Đức Huy", "Vũ Tuệ Mẫn", "Hoàng Gia Hưng", "Đỗ Khánh Vy",
  "Bùi Quang Khải", "Phan Mai Chi", "Ngô Nhật Minh", "Dương Ngọc Diệp", "Lý Thái Sơn", "Trịnh Phương Thảo",
  "Đặng Minh Khôi", "Võ Quỳnh Như", "Hồ Quốc Bảo", "Đinh Thảo Nguyên", "Lương Tuấn Kiệt", "Mai Anh Thư",
  "Tạ Hoàng Long", "Nguyễn Thục Quyên", "Cao Trọng Tín", "Hà Bảo Ngọc", "Chu Minh Trí", "Huỳnh Tấn Phát",
  "Vương Ánh Dương", "Phan Cẩm Tú", "Lê Gia Bách",
];

// A fixed pseudo-random sequence, so every fresh stack shows the same class.
let seed = 20260905;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

/** The demo's own codes, drawn from the seeded sequence so the same class comes back every time. */
const demoCode = (length: number) =>
  Array.from({ length }, () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]!).join("");

const q = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const sql: string[] = [];
const insert = (table: string, row: Record<string, string | number | null>) =>
  sql.push(`INSERT INTO ${table} (${Object.keys(row).join(", ")}) VALUES (${Object.values(row).map(q).join(", ")});`);

function hash(password: string): string {
  const salt = randomBytes(16);
  const dk = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

const now = new Date();
const DAY = 86_400_000;
/** A school-hours instant `daysAgo` days back: 7:30 to 16:30 local, stored as UTC. */
function schoolTime(daysAgo: number): string {
  const d = new Date(now.getTime() - daysAgo * DAY);
  const local = localDate(d);
  const minutes = 7 * 60 + 30 + Math.floor(rand() * 9 * 60);
  const utc = Date.parse(`${local}T00:00:00Z`) - 7 * 3_600_000 + minutes * 60_000;
  return new Date(Math.min(utc, now.getTime() - 60_000)).toISOString();
}
const isWeekday = (daysAgo: number) => {
  const wd = new Date(Date.parse(`${localDate(new Date(now.getTime() - daysAgo * DAY))}T00:00:00Z`)).getUTCDay();
  return wd >= 1 && wd <= 5;
};

export function buildDemoSql(): string {
  const y = Number(localDate(now).slice(0, 4));
  const startYear = Number(localDate(now).slice(5, 7)) >= 7 ? y : y - 1;
  const sem = defaultSemesters(startYear);

  insert("teachers", { id: 1, username: DEMO_TEACHER.username, display_name: DEMO_TEACHER.displayName, password_hash: hash(DEMO_TEACHER.password) });
  insert("classes", {
    id: 1,
    teacher_id: 1,
    name: "Lớp 4A",
    grade: 4,
    school_year: `${startYear}-${startYear + 1}`,
    motto: "Học vui mỗi ngày – Tiến bộ từng giờ – Tràn ngập yêu thương",
    group_count: 4,
    show_leaderboard: 1,
    hk1_start: sem.hk1Start,
    hk1_end: sem.hk1End,
    hk2_start: sem.hk2Start,
    hk2_end: sem.hk2End,
    teams: "[]",
    cover_shade: 0.35,
  });

  const taken = new Set<string>();
  const students = NAMES.map((fullName, i) => {
    let username = `${usernameStem(fullName)}.${demoCode(USERNAME_CODE_LENGTH)}`;
    while (taken.has(normalizeUsername(username))) username = `${usernameStem(fullName)}.${demoCode(USERNAME_CODE_LENGTH)}`;
    taken.add(normalizeUsername(username));
    const s = { id: i + 1, fullName, username, password: demoCode(PASSWORD_LENGTH), group: (i % 4) + 1 };
    insert("students", {
      id: s.id,
      class_id: 1,
      full_name: fullName,
      username,
      username_key: normalizeUsername(username),
      password: s.password,
      group_no: s.group,
      avatar_emoji: AVATAR_EMOJIS[i % AVATAR_EMOJIS.length]!,
      sort_order: i + 1,
    });
    return s;
  });

  DEFAULT_REASONS.forEach((r, i) =>
    insert("point_reasons", { id: i + 1, class_id: 1, label: r.label, emoji: r.emoji, category: r.category, kind: r.kind, sort_order: i }),
  );
  DEFAULT_REWARDS.forEach((r, i) => insert("rewards", { id: i + 1, class_id: 1, name: r.name, emoji: r.emoji, cost: r.cost, sort_order: i }));

  // Drops: most children get a few on most school days; a handful of gentle reminders.
  const stats = new Map(students.map((s) => [s.id, { drops: 0, kindness: 0 }]));
  const plus = DEFAULT_REASONS.filter((r) => r.kind === "plus");
  const minus = DEFAULT_REASONS.filter((r) => r.kind === "minus");
  let eventId = 1;
  for (let daysAgo = 20; daysAgo >= 0; daysAgo--) {
    if (!isWeekday(daysAgo)) continue;
    for (const s of students) {
      const diligence = 0.35 + ((s.id * 37) % 50) / 100;
      const n = Math.floor(rand() * 3 * diligence + (rand() < diligence ? 1 : 0));
      for (let k = 0; k < n; k++) {
        const neg = rand() < 0.1;
        const r = neg ? pick(minus) : pick(plus);
        const delta = neg ? -1 : pick([1, 1, 1, 2, 2, 3, 5]);
        insert("point_events", {
          id: eventId++,
          class_id: 1,
          student_id: s.id,
          delta,
          category: r.category,
          reason: r.label,
          emoji: r.emoji,
          created_at: schoolTime(daysAgo),
        });
        const st = stats.get(s.id)!;
        if (delta > 0) st.drops += delta;
        if (delta > 0 && r.category === "yeu_thuong") st.kindness++;
      }
    }
  }

  // Nhiệm vụ: notices the teacher gives out. Nothing is handed back, so there is nothing to mark.
  const addDays = (n: number) => localDate(new Date(now.getTime() + n * DAY));
  const tasks = [
    {
      id: 1,
      subject: "toan",
      title: "Ôn tập bảng nhân 6 và 7",
      instructions: "Học thuộc bảng nhân 6 và 7. Làm bài 1, 2, 3 trang 42 vào vở ô li.",
      published: 12,
      due: addDays(-5),
    },
    {
      id: 2,
      subject: "tieng_viet",
      title: "Chính tả: phân biệt s và x",
      instructions: "Viết lại đoạn “Sân trường em” và gạch chân các tiếng có s, x. Nhớ viết hoa đầu câu.",
      published: 5,
      due: addDays(2),
    },
    {
      id: 3,
      subject: "tieng_viet",
      title: "Viết đoạn văn tả cây bóng mát ở sân trường",
      instructions: "Viết một đoạn văn từ 5 đến 7 câu. Nhớ tả tán lá, thân cây và điều con thích nhất ở cây.",
      published: 3,
      due: addDays(4),
    },
    {
      id: 4,
      subject: "toan",
      title: "Phép chia cho số có một chữ số",
      instructions: "Làm bài 1 và bài 2 trang 48. Bài 3 dành cho bạn nào muốn thử sức.",
      published: 0,
      due: addDays(5),
    },
  ] as const;
  for (const t of tasks) {
    const publishedAt = schoolTime(t.published);
    insert("tasks", {
      id: t.id,
      class_id: 1,
      subject: t.subject,
      kind: "open",
      title: t.title,
      instructions: t.instructions,
      due_date: t.due,
      status: "published",
      published_at: publishedAt,
      created_at: publishedAt,
    });
  }

  // Badges the rules would have given, plus a few from the teacher.
  for (const s of students) {
    for (const key of autoBadgeKeys(stats.get(s.id)!)) {
      insert("student_badges", { class_id: 1, student_id: s.id, badge_key: key, source: "auto", awarded_at: schoolTime(Math.floor(rand() * 10)) });
    }
  }
  insert("student_badges", { class_id: 1, student_id: 3, badge_key: "reader", source: "teacher", note: "Đọc hết 5 cuốn truyện trong tháng", awarded_at: schoolTime(4) });
  insert("student_badges", { class_id: 1, student_id: 9, badge_key: "friend", source: "teacher", note: "Luôn giúp bạn giải bài khó", awarded_at: schoolTime(2) });
  insert("student_badges", { class_id: 1, student_id: 14, badge_key: "progress", source: "teacher", awarded_at: schoolTime(1) });

  // Rewards the teacher has handed over.
  insert("redemptions", { class_id: 1, student_id: 1, reward_id: 1, reward_name: DEFAULT_REWARDS[0]!.name, emoji: DEFAULT_REWARDS[0]!.emoji, cost: DEFAULT_REWARDS[0]!.cost, status: "approved", requested_at: schoolTime(6), decided_at: schoolTime(5) });
  insert("redemptions", { class_id: 1, student_id: 5, reward_id: 2, reward_name: DEFAULT_REWARDS[1]!.name, emoji: DEFAULT_REWARDS[1]!.emoji, cost: DEFAULT_REWARDS[1]!.cost, status: "approved", requested_at: schoolTime(1), decided_at: schoolTime(1) });
  insert("redemptions", { class_id: 1, student_id: 12, reward_id: 1, reward_name: DEFAULT_REWARDS[0]!.name, emoji: DEFAULT_REWARDS[0]!.emoji, cost: DEFAULT_REWARDS[0]!.cost, status: "approved", requested_at: schoolTime(0), decided_at: schoolTime(0) });

  // The teacher's remarks, a few family threads, the class notice board.
  const notes: [number, string][] = [
    [1, "Tuần này Minh Anh phát biểu rất sôi nổi. Cô rất vui vì con tự tin hơn nhiều!"],
    [2, "Bảo Nam làm toán nhanh và cẩn thận. Con cố gắng viết chữ đẹp hơn nhé."],
    [4, "Đức Huy hay giúp đỡ bạn cùng bàn. Cô khen con!"],
  ];
  notes.forEach(([sid, body], i) => insert("notes", { class_id: 1, student_id: sid, body, created_at: schoolTime(3 - i) }));
  const threads: [number, "teacher" | "family", string, number, boolean][] = [
    [1, "family", "Thưa cô, cháu Minh Anh dạo này có hay mất tập trung không ạ?", 4, true],
    [1, "teacher", "Chào chị, Minh Anh ở lớp rất ngoan và chăm phát biểu. Chị yên tâm ạ.", 4, true],
    [7, "family", "Thưa cô, mai cháu Khánh Vy xin nghỉ học một buổi vì đi khám răng ạ.", 1, true],
    [7, "teacher", "Cô nhận được rồi ạ. Chúc con khám răng thuận lợi.", 1, false],
    [16, "family", "Cô ơi, bài tập Tiếng Việt tuần này con làm trên app hay làm vào vở ạ?", 0, false],
  ];
  threads.forEach(([sid, sender, body, daysAgo, read]) =>
    insert("messages", { class_id: 1, student_id: sid, sender, body, created_at: schoolTime(daysAgo), read_at: read ? schoolTime(0) : null }),
  );
  insert("announcements", {
    class_id: 1,
    title: "Họp phụ huynh đầu năm học",
    body: "Thứ bảy tuần này, 8 giờ sáng, tại phòng học lớp 4A. Kính mời quý phụ huynh tham dự đầy đủ.",
    pinned: 1,
    created_at: schoolTime(6),
  });
  insert("announcements", {
    class_id: 1,
    title: "Tuần lễ đọc sách",
    body: "Mỗi con mang một cuốn sách yêu thích đến lớp để trao đổi với các bạn.",
    pinned: 0,
    created_at: schoolTime(2),
  });

  // The board: this month's chủ điểm and a wall of notes, some with hearts and a comment under them.
  const month = localDate(now).slice(0, 7);
  insert("board_months", {
    class_id: 1,
    month,
    theme: MONTH_THEMES[Number(month.slice(5, 7))] ?? "Lớp mình cùng cố gắng",
    note: "Tuần này lớp mình trang trí góc học tập và đọc sách cùng nhau.",
    emoji: "🌼",
    created_at: schoolTime(12),
    updated_at: schoolTime(12),
  });
  const posts: [PostKind, string, string, string, number, number, string | null][] = [
    ["hoat_dong", "Góc học tập của lớp mình", "Các con cùng nhau trang trí góc học tập. Bạn nào cũng khéo tay!", "vang", 1, 9, null],
    ["viec_nha", "Ôn bảng nhân 8", "Mỗi con đọc thuộc bảng nhân 8 và làm 5 phép tính vào vở nhé.", "xanh", 0, 3, localDate(new Date(now.getTime() + DAY))],
    ["hoat_dong", "Tiết Tiếng Việt: kể chuyện", "Nhóm 2 kể chuyện “Cây khế” trước lớp, cả lớp vỗ tay khen các bạn.", "bac_ha", 0, 6, null],
    ["loi_nhan", "Nhắc nhẹ quý phụ huynh", "Sáng mai lớp mình mặc đồng phục thể dục ạ.", "hong", 0, 2, null],
  ];
  posts.forEach(([kind, title, body, color, pinned, likes, due], i) => {
    const id = i + 1;
    insert("posts", {
      id,
      class_id: 1,
      month,
      kind,
      title,
      body,
      color,
      pinned,
      due_date: due,
      photo_count: 0,
      created_at: schoolTime(i * 3 + 1),
      updated_at: schoolTime(i * 3 + 1),
    });
    for (let k = 0; k < likes; k++) {
      insert("post_likes", { post_id: id, student_id: students[(k * 3 + i) % students.length]!.id, created_at: schoolTime(i * 3) });
    }
  });
  insert("post_comments", { post_id: 1, class_id: 1, author: "family", student_id: 3, body: "Lớp mình trang trí đẹp quá cô ơi!", created_at: schoolTime(1) });
  insert("post_comments", { post_id: 1, class_id: 1, author: "teacher", student_id: null, body: "Cảm ơn chị ạ, các con làm hết đấy ạ.", created_at: schoolTime(1) });
  insert("post_comments", { post_id: 2, class_id: 1, author: "family", student_id: 7, body: "Dạ vâng, tối nay cháu sẽ ôn ạ.", created_at: schoolTime(0) });

  // Hồ sơ Măng non: a filled-in page for about half the class, so the book is worth opening.
  const HOBBIES = ["Đọc truyện tranh", "Đá bóng", "Vẽ tranh", "Múa", "Chơi cờ vua", "Hát", "Trồng cây", "Bơi lội", "Làm đồ thủ công"];
  const DREAMS = ["Làm bác sĩ", "Làm cô giáo", "Làm phi hành gia", "Làm cầu thủ", "Làm hoạ sĩ", "Làm kỹ sư", "Làm đầu bếp", "Làm chú bộ đội"];
  const DUTY_BY_INDEX: Record<number, string> = { 0: "Lớp trưởng", 1: "Lớp phó học tập", 2: "Lớp phó văn thể", 3: "Tổ trưởng", 4: "Tổ trưởng", 5: "Tổ trưởng", 6: "Tổ trưởng" };
  students.forEach((s, i) => {
    if (i % 2 === 1 && i > 6) return; // not every child has filled their page in yet
    const birthYear = startYear - 9;
    const bMonth = ((i * 5) % 12) + 1;
    const bDay = ((i * 7) % 27) + 1;
    sql.push(
      `UPDATE students SET birthday = ${q(`${birthYear}-${String(bMonth).padStart(2, "0")}-${String(bDay).padStart(2, "0")}`)}, ` +
        `gender = ${q(i % 2 === 0 ? "nu" : "nam")}, hobby = ${q(HOBBIES[i % HOBBIES.length]!)}, ` +
        `dream = ${q(DREAMS[i % DREAMS.length]!)}, duty = ${q(DUTY_BY_INDEX[i] ?? "")} WHERE id = ${s.id};`,
    );
  });

  // Chuyên cần: the register for the last three school weeks, and the drop each day at school is worth.
  for (let daysAgo = 20; daysAgo >= 0; daysAgo--) {
    if (!isWeekday(daysAgo)) continue;
    const day = localDate(new Date(now.getTime() - daysAgo * DAY));
    for (const s of students) {
      const roll = rand();
      const status = roll > 0.97 ? "co_phep" : roll > 0.955 ? "khong_phep" : roll > 0.93 ? "di_muon" : "co_mat";
      insert("attendance", {
        class_id: 1,
        student_id: s.id,
        day,
        status,
        note: status === "co_phep" ? "Gia đình xin phép" : "",
        created_at: schoolTime(daysAgo),
        updated_at: schoolTime(daysAgo),
      });
      if (status === "co_mat" || status === "di_muon") {
        insert("point_events", {
          id: eventId++,
          class_id: 1,
          student_id: s.id,
          delta: 1,
          category: "ren_luyen",
          reason: ATTENDANCE_REASON,
          emoji: ATTENDANCE_EMOJI,
          batch_id: `chuyen-can:${day}`,
          created_at: schoolTime(daysAgo),
        });
      }
    }
  }

  // Vinh danh: the two weeks just gone, and this month so far.
  const byDrops = [...students].sort((a, b) => (stats.get(b.id)!.drops ?? 0) - (stats.get(a.id)!.drops ?? 0));
  const weekStart = (daysAgo: number) => {
    const d = localDate(new Date(now.getTime() - daysAgo * DAY));
    const wd = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
    return localDate(new Date(Date.parse(`${d}T00:00:00Z`) - wd * DAY));
  };
  const honours: [number, "week" | "month", string, string, string][] = [
    [byDrops[0]!.id, "week", weekStart(7), "Ngôi sao của tuần", "Con phát biểu rất sôi nổi."],
    [byDrops[1]!.id, "week", weekStart(7), "Ngôi sao của tuần", "Con giúp bạn rất nhiều."],
    [byDrops[0]!.id, "month", `${month}-01`, "Ngôi sao của tháng", "Con tiến bộ rõ rệt trong tháng này."],
  ];
  honours.forEach(([sid, period, key, title, note]) =>
    insert("honours", {
      class_id: 1,
      student_id: sid,
      period,
      period_key: key,
      period_label: period === "week" ? weekPeriod(key).label : monthPeriod(key).label,
      title,
      note,
      points: stats.get(sid)!.drops,
      created_at: schoolTime(period === "week" ? 3 : 1),
    }),
  );

  // Seats, grouped by team.
  const seats: Record<string, number> = {};
  [...students].sort((a, b) => a.group - b.group).forEach((s, i) => {
    seats[`${Math.floor(i / 8) + 1}-${Math.floor((i % 8) / 2) + 1}-${(i % 2) + 1}`] = s.id;
  });
  sql.push(`UPDATE classes SET seating = ${q(JSON.stringify({ rows: 4, desks: 4, seatsPerDesk: 2, seats }))} WHERE id = 1;`);

  return sql.join("\n") + "\n";
}

const outIdx = process.argv.indexOf("--out");
if (outIdx > 0) {
  const out = process.argv[outIdx + 1]!;
  const text = buildDemoSql();
  writeFileSync(out, text);
  console.log(`demo seed: ${text.split("\n").filter(Boolean).length} statements → ${out}`);
  const accounts = [...text.matchAll(/INSERT INTO students \([^)]*\) VALUES \(\d+, 1, '([^']*)', '([^']*)', '[^']*', '([^']*)'/g)];
  console.log("demo student accounts:", accounts.slice(0, 3).map((m) => `${m[1]} → ${m[2]} / ${m[3]}`).join("  |  "));
}
