import { z } from "zod";
import "./zod-vi";
import {
  ATTENDANCE_STATUSES,
  AVATAR_EMOJIS,
  DUTIES,
  GENDERS,
  COMPETITION_PERIODS,
  HONOUR_PERIODS,
  MAX_COMPETITION_ROWS,
  MAX_POST_PHOTOS,
  POST_COLORS,
  POST_KINDS,
  POST_LAYOUTS,
  POST_STICKERS,
  MAX_STUDENTS_PER_CLASS,
  POINT_CATEGORIES,
  SUBJECTS,
} from "./constants";
import { MAX_NAME_LENGTH } from "./student-list";

const text = (min: number, max: number, message?: string) =>
  z
    .string()
    .trim()
    .min(min, message ?? `Cần ít nhất ${min} ký tự.`)
    .max(max, `Tối đa ${max} ký tự.`);

/** A real calendar date as YYYY-MM-DD: "2026-02-30" is refused. */
export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const t = new Date(Date.UTC(y!, m! - 1, d!));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m! - 1 && t.getUTCDate() === d;
  }, "Ngày không hợp lệ.");
const id = z.number().int().positive();
const emoji = z.string().trim().min(1, "Chọn một biểu tượng.").max(16);

// Accounts ------------------------------------------------------------------

export const loginInput = z.object({
  username: z.string().trim().min(1, "Nhập tên đăng nhập.").max(60),
  password: z.string().min(1, "Nhập mật khẩu.").max(100),
});
export type LoginInput = z.infer<typeof loginInput>;

export const teacherRegisterInput = z.object({
  inviteCode: z.string().trim().min(1, "Nhập mã mời.").max(100),
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập cần ít nhất 3 ký tự.")
    .max(32, "Tối đa 32 ký tự.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Chỉ dùng chữ không dấu, số, dấu chấm hoặc gạch ngang."),
  displayName: text(2, 60, "Nhập tên hiển thị, ví dụ: Cô Hoa."),
  password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự.").max(100),
});
export type TeacherRegisterInput = z.infer<typeof teacherRegisterInput>;

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại.").max(100),
    newPassword: z.string().min(6, "Mật khẩu mới cần ít nhất 6 ký tự.").max(64, "Tối đa 64 ký tự."),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Mật khẩu mới phải khác mật khẩu cũ.",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

// Classes and students ------------------------------------------------------

const classFields = {
  name: text(1, 60, "Nhập tên lớp."),
  grade: z.number().int().min(1).max(5),
  schoolYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Năm học có dạng 2026-2027.")
    .refine((s) => Number(s.slice(5)) === Number(s.slice(0, 4)) + 1, "Năm học có dạng 2026-2027."),
  motto: z.string().trim().max(140, "Tối đa 140 ký tự."),
  groupCount: z.number().int().min(1).max(8),
  showLeaderboard: z.boolean(),
  hk1Start: dateField,
  hk1End: dateField,
  hk2Start: dateField,
  hk2End: dateField,
  teams: z
    .array(
      z.object({
        name: text(1, 40, "Nhập tên tổ."),
        emoji: emoji,
        leaderId: id.nullable(),
        deputyId: id.nullable(),
      }),
    )
    .max(8),
  /** 0 to 0.8: how dark the band behind the text on the cover photo is. */
  coverShade: z.number().min(0).max(0.8),
};

export const classInput = z.object({
  ...classFields,
  motto: classFields.motto.default(""),
  groupCount: classFields.groupCount.default(4),
  showLeaderboard: classFields.showLeaderboard.default(true),
  hk1Start: dateField.optional(),
  hk1End: dateField.optional(),
  hk2Start: dateField.optional(),
  hk2End: dateField.optional(),
  teams: classFields.teams.optional(),
  coverShade: classFields.coverShade.default(0.35),
});
export type ClassInput = z.infer<typeof classInput>;

export const classPatch = z.object(classFields).partial();
export type ClassPatch = z.infer<typeof classPatch>;

export const studentsCreateInput = z.object({
  students: z
    .array(
      z.object({
        fullName: text(2, MAX_NAME_LENGTH, "Tên quá ngắn."),
        // Every child joins a tổ: it is what the class competes in, and the teacher sorts the register by.
        group: z.number({ error: "Bạn nào cũng cần có tổ." }).int().min(1, "Bạn nào cũng cần có tổ.").max(8),
        // The day of it is in the username (brief 6), and it fills the Măng non birthday.
        birthday: dateField.nullish(),
      }),
    )
    .min(1, "Danh sách đang trống.")
    .max(MAX_STUDENTS_PER_CLASS, `Mỗi lần thêm tối đa ${MAX_STUDENTS_PER_CLASS} học sinh.`),
});
export type StudentsCreateInput = z.infer<typeof studentsCreateInput>;

export const studentPatch = z.object({
  fullName: text(2, MAX_NAME_LENGTH, "Tên quá ngắn.").optional(),
  group: z.number().int().min(1).max(8).optional(),
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập cần ít nhất 3 ký tự.")
    .max(32)
    .regex(/^[A-Za-z0-9.-]+$/, "Chỉ dùng chữ không dấu, số, dấu chấm và dấu gạch ngang.")
    .optional(),
  avatarEmoji: z.enum(AVATAR_EMOJIS).optional(),
});
export type StudentPatch = z.infer<typeof studentPatch>;

export const avatarEmojiInput = z.object({ avatarEmoji: z.enum(AVATAR_EMOJIS) });

/**
 * "Sửa tổ": moves several children into a tổ in one save, instead of opening each child in turn. There is no way
 * to leave a child without one — every child belongs to a tổ, which is what the class competes in.
 */
export const groupsInput = z.object({
  moves: z
    .array(z.object({ studentId: id, group: z.number().int().min(1, "Bạn nào cũng cần có tổ.").max(8) }))
    .min(1, "Chưa có thay đổi nào.")
    .max(MAX_STUDENTS_PER_CLASS),
});
export type GroupsInput = z.infer<typeof groupsInput>;

export const imageInput = z.object({
  dataUrl: z
    .string()
    .max(700_000, "Ảnh quá lớn.")
    .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/, "Ảnh không hợp lệ."),
});

// Points ----------------------------------------------------------------------

export const pointsInput = z
  .object({
    studentIds: z.array(id).min(1, "Chọn ít nhất một học sinh.").max(MAX_STUDENTS_PER_CLASS),
    delta: z
      .number()
      .int()
      .min(-20)
      .max(20)
      .refine((d) => d !== 0, "Chọn số điểm."),
    /** Optional: a tap on a sticker scores at once, and the reason can be added later from the history. */
    reasonId: id.optional(),
  });
export type PointsInput = z.infer<typeof pointsInput>;

/** "Thêm lý do": attach a reason to a point already given. */
export const pointReasonPatch = z.object({ reasonId: id });

export const reasonInput = z.object({
  label: text(1, 80, "Nhập lý do."),
  emoji: emoji,
  category: z.enum(POINT_CATEGORIES),
  kind: z.enum(["plus", "minus"]),
  /** Drops the criterion is worth (brief 7). The sign is `kind`; the same cap as one award. */
  drops: z.number({ error: "Nhập số giọt nước." }).int("Số giọt nước là số nguyên.").min(1, "Ít nhất 1 giọt nước.").max(20, "Nhiều nhất 20 giọt nước.").default(1),
});
export type ReasonInput = z.infer<typeof reasonInput>;

// Tasks -----------------------------------------------------------------------

/**
 * Giao việc: a title, what to do, and the day it is for. Nothing is handed back. The subject is no longer asked or
 * shown ("Bỏ phân môn", brief 9); the column stays, and a new task is "khac".
 */
const taskFields = {
  subject: z.enum(SUBJECTS),
  title: text(1, 120, "Nhập tên nhiệm vụ."),
  instructions: z.string().trim().max(3000, "Tối đa 3000 ký tự."),
  /** Local date: the work is for the end of that day. */
  dueDate: dateField.nullable(),
};

export const taskInput = z.object({
  ...taskFields,
  subject: taskFields.subject.default("khac"),
  instructions: taskFields.instructions.default(""),
  dueDate: taskFields.dueDate.default(null),
  status: z.enum(["draft", "published"]).default("published"),
});
export type TaskInput = z.infer<typeof taskInput>;

export const taskPatch = z.object({ ...taskFields, status: z.enum(["draft", "published", "closed"]) }).partial();
export type TaskPatch = z.infer<typeof taskPatch>;

// Rewards, badges, notes, messages ---------------------------------------------

export const rewardInput = z.object({
  name: text(1, 80, "Nhập tên phần quà."),
  emoji: emoji,
  cost: z.number().int().min(1, "Ít nhất 1 giọt nước.").max(1000),
  active: z.boolean().default(true),
});
export type RewardInput = z.infer<typeof rewardInput>;

export const rewardPatch = rewardInput.partial();

export const redemptionDecision = z.object({ status: z.enum(["approved", "rejected"]) });

export const badgeAwardInput = z.object({
  studentIds: z.array(id).min(1, "Chọn ít nhất một học sinh.").max(MAX_STUDENTS_PER_CLASS),
  badgeKey: z.string().min(1).max(40),
  note: z.string().trim().max(200).optional(),
});
export type BadgeAwardInput = z.infer<typeof badgeAwardInput>;

export const noteInput = z.object({ body: text(1, 2000, "Viết nhận xét trước khi lưu.") });

export const messageInput = z.object({ body: text(1, 1000, "Viết lời nhắn trước khi gửi.") });

export const announcementInput = z.object({
  title: text(1, 120, "Nhập tiêu đề."),
  body: z.string().trim().max(3000, "Tối đa 3000 ký tự.").default(""),
  pinned: z.boolean().default(false),
});
export type AnnouncementInput = z.infer<typeof announcementInput>;

export const seatingInput = z.object({
  rows: z.number().int().min(1).max(6),
  desks: z.number().int().min(1).max(8),
  seatsPerDesk: z.number().int().min(1).max(3),
  seats: z.record(z.string().regex(/^\d-\d-\d$/), id),
});
export type SeatingInput = z.infer<typeof seatingInput>;

export const reportQuery = z.object({
  period: z.enum(["week", "month", "semester", "year"]).default("week"),
  date: dateField.optional(),
  semester: z.enum(["1", "2"]).optional(),
});

// The class board -------------------------------------------------------------

/** 'YYYY-MM' on the Vietnam calendar. */
export const monthField = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Tháng không hợp lệ.");

export const boardMonthInput = z.object({
  theme: text(1, 120, "Nhập chủ đề của tháng."),
  note: z.string().trim().max(300, "Tối đa 300 ký tự.").default(""),
  emoji: emoji.default("🌼"),
});
export type BoardMonthInput = z.infer<typeof boardMonthInput>;

export const postInput = z.object({
  kind: z.enum(POST_KINDS),
  title: text(1, 120, "Nhập tiêu đề của ô."),
  body: z.string().trim().max(2000, "Tối đa 2000 ký tự.").default(""),
  color: z.enum(POST_COLORS).default("vang"),
  sticker: z.enum(POST_STICKERS).or(z.literal("")).default(""),
  layout: z.enum(POST_LAYOUTS).default("ghim"),
  pinned: z.boolean().default(false),
  dueDate: dateField.nullish(),
  month: monthField.optional(),
});
export type PostInput = z.infer<typeof postInput>;

/**
 * Editing a tile. Spelled out rather than `postInput.partial()`, because a partial still carries the defaults:
 * a PATCH that only renames a tile would quietly paint it yellow again and unpin its sticker.
 */
export const postPatchInput = z.object({
  kind: z.enum(POST_KINDS).optional(),
  title: text(1, 120, "Nhập tiêu đề của ô.").optional(),
  body: z.string().trim().max(2000, "Tối đa 2000 ký tự.").optional(),
  color: z.enum(POST_COLORS).optional(),
  sticker: z.enum(POST_STICKERS).or(z.literal("")).optional(),
  layout: z.enum(POST_LAYOUTS).optional(),
  pinned: z.boolean().optional(),
  dueDate: dateField.nullish(),
  month: monthField.optional(),
});

export const postPhotoInput = z.object({
  dataUrl: z
    .string()
    .max(700_000, "Ảnh quá lớn.")
    .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/, "Ảnh không hợp lệ."),
});

/** "Sản phẩm của em": a photo of a marked test or a piece of work, with a label if she has time to write one. */
export const workInput = z.object({
  title: z.string().trim().max(120, "Tối đa 120 ký tự.").default(""),
  dataUrl: z
    .string()
    .max(700_000, "Ảnh quá lớn.")
    .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+\/]+=*$/, "Ảnh không hợp lệ."),
});
export type WorkInput = z.infer<typeof workInput>;

export const commentInput = z.object({ body: text(1, 500, "Viết lời bình luận trước khi gửi.") });
export type CommentInput = z.infer<typeof commentInput>;

export const boardQuery = z.object({ month: monthField.optional() });

export { MAX_POST_PHOTOS };

// Hồ sơ Măng non --------------------------------------------------------------

const profileText = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`);

/** What the teacher may set on a child's profile. */
export const profileInput = z.object({
  birthday: dateField.nullish(),
  gender: z.enum(GENDERS).nullish(),
  hobby: profileText(120).optional(),
  dream: profileText(120).optional(),
  duty: profileText(60).optional(),
});
export type ProfileInput = z.infer<typeof profileInput>;

/** What a child may set on their own: their chức vụ is the teacher's to give. */
export const myProfileInput = profileInput.omit({ duty: true });
export type MyProfileInput = z.infer<typeof myProfileInput>;

export { DUTIES };

// Chuyên cần --------------------------------------------------------------------

export const attendanceInput = z.object({
  day: dateField.optional(),
  marks: z
    .array(z.object({ studentId: id, status: z.enum(ATTENDANCE_STATUSES), note: profileText(120).optional() }))
    .min(1, "Chọn ít nhất một bạn.")
    .max(MAX_STUDENTS_PER_CLASS),
});
export type AttendanceInput = z.infer<typeof attendanceInput>;

export const attendanceQuery = z.object({
  day: dateField.optional(),
  period: z.enum(["week", "month", "semester", "year"]).default("month"),
  date: dateField.optional(),
  semester: z.enum(["1", "2"]).optional(),
});

// Vinh danh ----------------------------------------------------------------------

export const honourInput = z.object({
  studentIds: z.array(id).min(1, "Chọn ít nhất một bạn.").max(MAX_STUDENTS_PER_CLASS),
  period: z.enum(HONOUR_PERIODS),
  date: dateField.optional(),
  semester: z.enum(["1", "2"]).optional(),
  title: text(1, 80, "Nhập danh hiệu.").optional(),
  note: z.string().trim().max(300, "Tối đa 300 ký tự.").default(""),
});
export type HonourInput = z.infer<typeof honourInput>;

/** Kết quả thi đua (brief 12): one period of the school's results. */
export const competitionQuery = z.object({
  period: z.enum(COMPETITION_PERIODS).default("week"),
  date: dateField.optional(),
});

export const competitionInput = z.object({
  period: z.enum(COMPETITION_PERIODS),
  date: dateField.optional(),
  rows: z
    .array(
      z.object({
        name: text(1, 40, "Nhập tên lớp."),
        score: z.number({ error: "Nhập điểm." }).min(0, "Điểm từ 0 trở lên.").max(10000, "Điểm tối đa 10000."),
        isOurs: z.boolean().default(false),
      }),
    )
    .min(1, "Thêm ít nhất một lớp.")
    .max(MAX_COMPETITION_ROWS, `Tối đa ${MAX_COMPETITION_ROWS} lớp.`)
    // Her class is the red column: there is exactly one.
    .refine((rows) => rows.filter((r) => r.isOurs).length === 1, "Đánh dấu đúng một dòng là lớp của cô."),
});
export type CompetitionInput = z.infer<typeof competitionInput>;

/** Huy hiệu (brief 12): "Icon huy hiệu và nội dung Huy hiệu GV có thể chỉnh sửa". */
export const badgeLabelInput = z.object({
  emoji: emoji,
  name: text(1, 40, "Nhập tên huy hiệu."),
  description: z.string().trim().max(120, "Tối đa 120 ký tự.").default(""),
});
export type BadgeLabelInput = z.infer<typeof badgeLabelInput>;

export const honourQuery = z.object({
  period: z.enum(HONOUR_PERIODS).default("week"),
  date: dateField.optional(),
  semester: z.enum(["1", "2"]).optional(),
});
