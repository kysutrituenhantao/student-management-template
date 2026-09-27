export const APP_NAME = "Lớp Học Hạnh Phúc";
export const APP_TAGLINE = "Học vui mỗi ngày – Tiến bộ từng giờ – Tràn ngập yêu thương";

/**
 * Characters a child can't misread on a printed slip: no 0/O, no 1/l/i. Both the tail of a username and a password
 * are drawn from these.
 */
export const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
/** "an.k7m4": the given name, a dot, and four characters, so two children called An never collide. */
export const USERNAME_CODE_LENGTH = 4;
export const PASSWORD_LENGTH = 6;
/**
 * Brief 6: "Mật khẩu: Abc12345" — every new account and every reset. Because it is the same for the whole class, a
 * family that signs in with it chooses its own before anything else opens (`mustChangePassword`).
 */
export const DEFAULT_STUDENT_PASSWORD = "Abc12345";

export const SUBJECTS = ["toan", "tieng_viet", "khac"] as const;
export type Subject = (typeof SUBJECTS)[number];
export const SUBJECT_INFO: Record<Subject, { label: string; emoji: string }> = {
  toan: { label: "Toán", emoji: "🔢" },
  tieng_viet: { label: "Tiếng Việt", emoji: "📖" },
  khac: { label: "Môn khác", emoji: "🎨" },
};

/**
 * Nhiệm vụ is a noticeboard, not a workbook: the teacher writes what the class is to do and the family reads it.
 * Children hand nothing in through the app — "k cần HS trả bài trên web, chỉ hiển thị nội dung GV giao việc"
 * (brief 3, 24/09/2026).
 */
export const TASK_STATUSES = ["draft", "published", "closed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_INFO: Record<TaskStatus, { label: string }> = {
  draft: { label: "Nháp" },
  published: { label: "Đã giao" },
  closed: { label: "Đã đóng" },
};

/** "chung" holds quick taps on a sticker, which carry no reason until the teacher adds one from the history. */
export const POINT_CATEGORIES = ["hoc_tap", "ren_luyen", "yeu_thuong", "chung"] as const;
export type PointCategory = (typeof POINT_CATEGORIES)[number];
export const POINT_CATEGORY_INFO: Record<PointCategory, { label: string; emoji: string }> = {
  hoc_tap: { label: "Học tập", emoji: "📚" },
  ren_luyen: { label: "Rèn luyện", emoji: "🌱" },
  yeu_thuong: { label: "Yêu thương", emoji: "💖" },
  chung: { label: "Khen nhanh", emoji: "💧" },
};

/** Stored as the reason of a quick tap on a sticker. */
export const QUICK_REASON = { plus: "Khen nhanh", minus: "Nhắc nhở" } as const;

/** The quick-pick buttons on the scoring screen. */
export const POINT_STEPS = [1, 2, 3, 5, 10] as const;

export interface ReasonSeed {
  label: string;
  emoji: string;
  category: PointCategory;
  kind: "plus" | "minus";
}

export const DEFAULT_REASONS: ReasonSeed[] = [
  { label: "Phát biểu", emoji: "✋", category: "hoc_tap", kind: "plus" },
  { label: "Chăm chỉ", emoji: "📚", category: "hoc_tap", kind: "plus" },
  { label: "Việc tốt", emoji: "💗", category: "yeu_thuong", kind: "plus" },
  { label: "Giúp bạn", emoji: "🤝", category: "yeu_thuong", kind: "plus" },
  { label: "Tự tin", emoji: "🎤", category: "hoc_tap", kind: "plus" },
  { label: "Sáng tạo", emoji: "🎨", category: "hoc_tap", kind: "plus" },
  { label: "Tiến bộ", emoji: "🌟", category: "hoc_tap", kind: "plus" },
  { label: "Thành tích", emoji: "🏆", category: "hoc_tap", kind: "plus" },
  { label: "Giữ vệ sinh", emoji: "🧹", category: "ren_luyen", kind: "plus" },
  { label: "Lễ phép", emoji: "🙏", category: "ren_luyen", kind: "plus" },
  { label: "Chưa hoàn thành nhiệm vụ", emoji: "📝", category: "hoc_tap", kind: "minus" },
  { label: "Nói chuyện riêng", emoji: "🤫", category: "ren_luyen", kind: "minus" },
  { label: "Quên đồ dùng", emoji: "🎒", category: "ren_luyen", kind: "minus" },
  { label: "Chưa giữ trật tự", emoji: "🔇", category: "ren_luyen", kind: "minus" },
];

export const DEFAULT_REWARDS = [
  { name: "Nhãn dán dễ thương", emoji: "🦄", cost: 20 },
  { name: "Được chọn chỗ ngồi 1 ngày", emoji: "🪑", cost: 30 },
  { name: "Bút chì màu xinh", emoji: "✏️", cost: 40 },
  { name: "Làm trợ giảng 1 ngày", emoji: "🧑‍🏫", cost: 60 },
  { name: "Miễn 1 bài tập về nhà", emoji: "🎟️", cost: 80 },
  { name: "Phần quà bí mật", emoji: "🎁", cost: 100 },
];

/** Stickers a student can use as an avatar until (or instead of) uploading a photo. */
export const AVATAR_EMOJIS = [
  "🐰", "🐼", "🐱", "🦊", "🐯", "🐨", "🐸", "🦄", "🐧", "🐻", "🐹", "🐶",
  "🐵", "🦁", "🐮", "🐷", "🐤", "🐙", "🦋", "🐳", "🦉", "🐢", "🐞", "🦕",
] as const;

/** Default team names and mascots. The teacher can rename them. */
export const DEFAULT_TEAMS = [
  { name: "Thỏ Ngọc Chăm Chỉ", emoji: "🐰" },
  { name: "Họa Mi Vui Vẻ", emoji: "🐦" },
  { name: "Sóc Nâu Thông Thái", emoji: "🐿️" },
  { name: "Voi Con Dũng Mãnh", emoji: "🐘" },
  { name: "Cá Heo Thân Thiện", emoji: "🐬" },
  { name: "Ong Vàng Siêng Năng", emoji: "🐝" },
  { name: "Mèo Mướp Tinh Nghịch", emoji: "🐱" },
  { name: "Gấu Trúc Hiền Lành", emoji: "🐼" },
];

/** Image limits: avatars are square, the class cover is a wide banner. Both are resized in the browser. */
export const IMAGE_LIMITS = {
  avatar: { width: 256, height: 256, maxBytes: 120_000 },
  cover: { width: 1600, height: 600, maxBytes: 450_000 },
  post: { width: 1400, height: 1400, maxBytes: 450_000 },
  // A photographed test has to stay readable when a parent zooms in on a phone.
  work: { width: 1600, height: 1600, maxBytes: 450_000 },
} as const;

export const MAX_STUDENTS_PER_CLASS = 60;

// The class board ---------------------------------------------------------------------------------

/** Tiles on the board, in the order the teacher's "new tile" menu offers them. */
export const POST_KINDS = ["hoat_dong", "viec_nha", "loi_nhan"] as const;
export type PostKind = (typeof POST_KINDS)[number];
export const POST_KIND_INFO: Record<PostKind, { label: string; emoji: string; hint: string }> = {
  hoat_dong: { label: "Hoạt động của lớp", emoji: "📸", hint: "Ảnh và vài dòng kể lại buổi học, buổi sinh hoạt." },
  viec_nha: { label: "Việc ở nhà", emoji: "🏠", hint: "Việc các con làm ở nhà hôm nay. Ghi rõ ngày để phụ huynh theo dõi." },
  loi_nhan: { label: "Lời nhắn", emoji: "💌", hint: "Nhắn nhanh tới cả lớp và phụ huynh." },
};

/** Tile colours, so a board looks like a wall of sticky notes. The CSS carries the actual paper colour. */
export const POST_COLORS = ["vang", "hong", "xanh", "bac_ha", "tim", "cam"] as const;
export type PostColor = (typeof POST_COLORS)[number];
export const POST_COLOR_LABEL: Record<PostColor, string> = {
  vang: "Vàng",
  hong: "Hồng",
  xanh: "Xanh biển",
  bac_ha: "Bạc hà",
  tim: "Tím",
  cam: "Cam",
};

/** The chủ điểm a Vietnamese primary school follows through the year, offered when the teacher names a month. */
export const MONTH_THEMES: Record<number, string> = {
  1: "Mừng Đảng, mừng Xuân",
  2: "Em yêu Tết quê em",
  3: "Yêu quý mẹ và cô giáo",
  4: "Hoà bình và hữu nghị",
  5: "Bác Hồ kính yêu",
  6: "Hè vui, hè khoẻ",
  7: "Em là chiến sĩ nhỏ",
  8: "Chào năm học mới",
  9: "Mái trường mến yêu",
  10: "Chăm ngoan, học giỏi",
  11: "Biết ơn thầy cô giáo",
  12: "Uống nước nhớ nguồn",
};

/** Stickers for a tile on the board: "có các sticker trong mỗi ô padlet" (brief 4, item 6). */
export const POST_STICKERS = [
  "⭐", "🌟", "❤️", "🌸", "🌈", "🎈", "🎉", "🏆", "👏", "💐",
  "📣", "📚", "✏️", "🎨", "🎵", "⚽", "🍎", "🧁", "🐣", "🦋",
  "🌞", "🌱", "💡", "🧡", "🎁", "📅", "✅", "🔔", "📸", "🥰",
] as const;
export type PostSticker = (typeof POST_STICKERS)[number];

/** How a tile is laid out. "Giao diện các bảng tin đa dạng hơn" — the same note, in four shapes. */
export const POST_LAYOUTS = ["ghim", "nhan", "khung", "bang"] as const;
export type PostLayout = (typeof POST_LAYOUTS)[number];
export const POST_LAYOUT_INFO: Record<PostLayout, { label: string; hint: string }> = {
  ghim: { label: "Giấy ghim", hint: "Tờ giấy nhỏ có ghim ở trên, như bảng tin của lớp." },
  nhan: { label: "Nhãn dán", hint: "Mép giấy cong, nghiêng nhẹ như miếng dán trong vở." },
  khung: { label: "Khung ảnh", hint: "Viền dày, hợp với ô có ảnh." },
  bang: { label: "Bảng con", hint: "Nền đậm, chữ sáng — nổi bật giữa các ô khác." },
};

export const MAX_POST_PHOTOS = 6;
/** Enough for a school year of marked tests without letting one class fill the database. */
export const MAX_WORKS_PER_STUDENT = 40;
export const MAX_POSTS_PER_MONTH = 120;

/**
 * "Tệp hồ sơ" (brief 5): the forms and records that complete a child's Măng non page. Word, Excel, PowerPoint, PDF
 * or a photographed page. 5 MB holds a Word form with a phone photo pasted in; ten a child is a school year of them.
 * The type is always taken from the extension, and the first bytes must agree with it.
 */
export const STUDENT_FILE_TYPES = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
} as const;
export type StudentFileExt = keyof typeof STUDENT_FILE_TYPES;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES_PER_STUDENT = 10;
/**
 * All the files of one class together. The free D1 database holds 500 MB for everything, and a file is stored as
 * base64, a third bigger than it is; 100 MB is several forms a child for a class of 40, and leaves room for the rest.
 */
export const MAX_FILE_BYTES_PER_CLASS = 100 * 1024 * 1024;
export const MAX_FILE_NAME = 160;
export const FILE_TOO_LARGE = `Tệp lớn quá, mỗi tệp tối đa ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
export const FILE_WRONG_TYPE = "Chỉ lưu được tệp Word, Excel, PowerPoint, PDF hoặc ảnh.";

/** "doc" for "Phiếu An.DOC", or null when it is not a type the class keeps. */
export function studentFileExt(name: string): StudentFileExt | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return name.includes(".") && ext in STUDENT_FILE_TYPES ? (ext as StudentFileExt) : null;
}

// Hồ sơ Măng non ----------------------------------------------------------------------------------

export const GENDERS = ["nu", "nam"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_INFO: Record<Gender, { label: string; emoji: string }> = {
  nu: { label: "Nữ", emoji: "👧" },
  nam: { label: "Nam", emoji: "👦" },
};

/** Chức vụ. Offered as chips; the teacher can type anything else. */
export const DUTIES = [
  "Lớp trưởng",
  "Lớp phó học tập",
  "Lớp phó văn thể",
  "Tổ trưởng",
  "Tổ phó",
  "Sao đỏ",
  "Quản ca",
  "Thủ quỹ",
] as const;

// Chuyên cần --------------------------------------------------------------------------------------

export const ATTENDANCE_STATUSES = ["co_mat", "di_muon", "co_phep", "khong_phep"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
/** `drop`: the child was at school, so the register gives them their daily drop. */
export const ATTENDANCE_INFO: Record<AttendanceStatus, { label: string; short: string; emoji: string; drop: boolean }> = {
  co_mat: { label: "Có mặt", short: "Có", emoji: "🙋", drop: true },
  di_muon: { label: "Đi muộn", short: "Muộn", emoji: "⏰", drop: true },
  co_phep: { label: "Nghỉ có phép", short: "Phép", emoji: "📩", drop: false },
  khong_phep: { label: "Nghỉ không phép", short: "Không phép", emoji: "❗", drop: false },
};
/** The reason written on the drop the register gives. */
export const ATTENDANCE_REASON = "Đi học chuyên cần";
export const ATTENDANCE_EMOJI = "📅";

// Vinh danh ---------------------------------------------------------------------------------------

export const HONOUR_PERIODS = ["week", "month", "semester", "year"] as const;
export type HonourPeriod = (typeof HONOUR_PERIODS)[number];
/** Kết quả thi đua (brief 12): the school's results are kept by week and by month. */
export const COMPETITION_PERIODS = ["week", "month"] as const;
export type CompetitionPeriod = (typeof COMPETITION_PERIODS)[number];
/** More classes than a primary school has, so a whole school always fits. */
export const MAX_COMPETITION_ROWS = 60;

export const HONOUR_INFO: Record<HonourPeriod, { title: string; label: string; emoji: string }> = {
  week: { title: "Ngôi sao của tuần", label: "Tuần", emoji: "🌟" },
  month: { title: "Ngôi sao của tháng", label: "Tháng", emoji: "🏅" },
  semester: { title: "Ngôi sao của học kỳ", label: "Học kỳ", emoji: "🏆" },
  year: { title: "Ngôi sao của năm", label: "Năm học", emoji: "👑" },
};
