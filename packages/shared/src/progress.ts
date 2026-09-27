/**
 * Every plus point is a drop of water, and the drops grow the child's plant.
 *
 * She wrote this ladder herself on 24 September 2026, after seeing the first one and doing the arithmetic a
 * nine-year-old would do: "800 giọt hs è khóc ngất vì kb bao giờ cây ra hoa. Haha" — at 800 drops a child cries,
 * because they can't see a flower ever happening. So it flowers at 300, fruits at 400 and ripens at 500.
 *
 * Minus points never take a stage away — a plant that has grown does not shrink back.
 */
export const LEVELS = [
  { level: 1, name: "Hạt giống", emoji: "🌰", min: 0 },
  { level: 2, name: "Nảy mầm", emoji: "🌱", min: 10 },
  { level: 3, name: "Hai lá mầm", emoji: "🌿", min: 50 },
  { level: 4, name: "Lá con", emoji: "☘️", min: 100 },
  { level: 5, name: "Cây con", emoji: "🪴", min: 150 },
  { level: 6, name: "Cây xanh tốt", emoji: "🌳", min: 200 },
  { level: 7, name: "Cây ra nụ", emoji: "🌷", min: 250 },
  { level: 8, name: "Cây nở hoa", emoji: "🌸", min: 300 },
  { level: 9, name: "Cây có quả", emoji: "🍏", min: 400 },
  { level: 10, name: "Quả chín", emoji: "🍎", min: 500 },
] as const;

/**
 * "Sau 500 cây tự thêm level mỗi lần thêm 100 giọt (vẫn hiện quả đỏ k thay đổi giao diện chỉ thay đổi lv)."
 *
 * The drawn stages stop at ripe fruit, but the levels do not: a child who keeps going gains one every hundred
 * drops, with the same tree and the same red fruit — only the number climbs. So the bar is never full and there is
 * always something left to earn, right through to the end of the school year.
 */
export const ENDLESS_STEP = 100;
const TOP = LEVELS[LEVELS.length - 1]!;

export interface Level {
  level: number;
  name: string;
  emoji: string;
  min: number;
}

export interface LevelInfo extends Level {
  /** There is always one: past the ripe fruit the levels carry on every hundred drops. */
  next: Level | null;
  /** Drops still needed for the next level. */
  toNext: number;
  /** 0 to 1 within the current level. */
  progress: number;
}

/** What a level number is called and what it costs — for any level, drawn or beyond the drawn ones. */
export function levelInfo(level: number): Level {
  const n = Math.max(1, Math.floor(level));
  const drawn = LEVELS[n - 1];
  if (drawn) return { ...drawn };
  return { level: n, name: TOP.name, emoji: TOP.emoji, min: TOP.min + (n - TOP.level) * ENDLESS_STEP };
}

export function levelFor(drops: number): LevelInfo {
  const level =
    drops >= TOP.min
      ? TOP.level + Math.floor((drops - TOP.min) / ENDLESS_STEP)
      : LEVELS.filter((l) => drops >= l.min).length;
  const cur = levelInfo(level);
  const next = levelInfo(level + 1);
  return {
    ...cur,
    next,
    toNext: next.min - drops,
    progress: (drops - cur.min) / (next.min - cur.min),
  };
}

export interface BadgeDef {
  key: string;
  name: string;
  emoji: string;
  description: string;
  /** Auto badges are awarded by the app; the rest are given by the teacher. */
  auto: boolean;
}

export const BADGES: BadgeDef[] = [
  { key: "first_star", name: "Giọt nước đầu tiên", emoji: "💧", description: "Nhận giọt nước đầu tiên", auto: true },
  { key: "stars_50", name: "Chăm ngoan", emoji: "🏅", description: "Đạt 50 giọt nước", auto: true },
  { key: "stars_100", name: "Học sinh tiêu biểu", emoji: "🏆", description: "Đạt 100 giọt nước", auto: true },
  { key: "stars_200", name: "Vườn hoa rực rỡ", emoji: "👑", description: "Đạt 200 giọt nước", auto: true },
  // These two marked 350 and 550, which are nothing on her ladder any more: they now mark the blossom and the
  // ripe fruit. The keys stay as they are so a child who already holds one keeps it.
  { key: "stars_350", name: "Cây nở hoa rực rỡ", emoji: "🌸", description: "Đạt 300 giọt nước", auto: true },
  { key: "stars_550", name: "Cây trĩu quả", emoji: "🍎", description: "Đạt 500 giọt nước", auto: true },
  { key: "kind_heart", name: "Trái tim ấm áp", emoji: "💖", description: "5 lần được khen việc tốt, giúp bạn", auto: true },
  { key: "kind_20", name: "Tấm lòng vàng", emoji: "💛", description: "20 lần được khen việc tốt, giúp bạn", auto: true },
  // These three counted work handed in through the app. Children no longer do that (brief 3, item 2), so they
  // stay here — a child who earned one keeps it — but from now on the teacher gives them herself.
  { key: "math_5", name: "Nhà toán học nhí", emoji: "🔢", description: "Cô khen vì con học Toán giỏi", auto: false },
  { key: "viet_5", name: "Cây bút nhí", emoji: "✍️", description: "Cô khen vì con viết chữ đẹp, văn hay", auto: false },
  { key: "perfect_quiz", name: "Điểm tuyệt đối", emoji: "💯", description: "Cô khen vì con làm bài xuất sắc", auto: false },
  { key: "progress", name: "Tiến bộ vượt bậc", emoji: "🚀", description: "Cô khen vì con tiến bộ rõ rệt", auto: false },
  { key: "reader", name: "Mọt sách nhí", emoji: "📖", description: "Cô khen vì con chăm đọc sách", auto: false },
  { key: "leader", name: "Cán bộ gương mẫu", emoji: "🎖️", description: "Cô khen vì con làm gương cho lớp", auto: false },
  { key: "artist", name: "Nghệ sĩ nhí", emoji: "🎨", description: "Cô khen vì con khéo tay, sáng tạo", auto: false },
  { key: "athlete", name: "Kiện tướng thể thao", emoji: "⚽", description: "Cô khen vì con chăm vận động", auto: false },
  { key: "friend", name: "Người bạn tốt", emoji: "🤗", description: "Cô khen vì con luôn giúp đỡ bạn", auto: false },
  { key: "tidy", name: "Bé ngăn nắp", emoji: "🧺", description: "Cô khen vì con gọn gàng, sạch sẽ", auto: false },
  { key: "brave", name: "Dũng cảm phát biểu", emoji: "🙋", description: "Cô khen vì con tự tin phát biểu", auto: false },
];

/** Looked up by keys that arrive in requests, so it has no prototype: "constructor" or "__proto__" find nothing. */
export const BADGE_BY_KEY: Record<string, BadgeDef | undefined> = Object.assign(
  Object.create(null) as Record<string, BadgeDef | undefined>,
  Object.fromEntries(BADGES.map((b) => [b.key, b])),
);

export interface BadgeStats {
  /** Drops earned (sum of plus points). */
  drops: number;
  /** Plus points in the "yêu thương" (kindness) category. */
  kindness: number;
}

/** The badges the app hands out by itself. Both counts only ever grow, so a badge once earned is never lost. */
export function autoBadgeKeys(s: BadgeStats): string[] {
  const keys: string[] = [];
  if (s.drops >= 1) keys.push("first_star");
  if (s.drops >= 50) keys.push("stars_50");
  if (s.drops >= 100) keys.push("stars_100");
  if (s.drops >= 200) keys.push("stars_200");
  if (s.drops >= 300) keys.push("stars_350");
  if (s.drops >= 500) keys.push("stars_550");
  if (s.kindness >= 5) keys.push("kind_heart");
  if (s.kindness >= 20) keys.push("kind_20");
  return keys;
}
