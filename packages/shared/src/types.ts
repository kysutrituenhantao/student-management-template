import type {
  AttendanceStatus,
  CompetitionPeriod,
  Gender,
  HonourPeriod,
  PointCategory,
  PostColor,
  PostKind,
  PostLayout,
  Subject,
  TaskStatus,
} from "./constants";
import type { Period, PeriodKind, Semesters } from "./periods";
import type { BadgeDef, LevelInfo } from "./progress";

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

// Accounts ------------------------------------------------------------------

export interface TeacherMe {
  role: "teacher";
  id: number;
  username: string;
  displayName: string;
}

export interface StudentMe {
  role: "student";
  id: number;
  username: string;
  fullName: string;
  classId: number;
  className: string;
  teacherName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  /**
   * Still on the class's shared first password (Abc12345, brief 6): the family chooses its own before anything else
   * opens, and until then the API answers nothing but the password change.
   */
  mustChangePassword: boolean;
}

export type Me = TeacherMe | StudentMe;

// Classes -------------------------------------------------------------------

export interface ClassSummary {
  id: number;
  name: string;
  grade: number;
  schoolYear: string;
  motto: string;
  studentCount: number;
  coverUrl: string | null;
}

export interface Team {
  name: string;
  emoji: string;
  leaderId: number | null;
  deputyId: number | null;
}

export interface ClassDetail extends ClassSummary {
  groupCount: number;
  showLeaderboard: boolean;
  semesters: Semesters;
  teacherName: string;
  /** One entry per group (tổ), index 0 is Tổ 1. */
  teams: Team[];
  coverShade: number;
}

export interface StudentRow {
  id: number;
  fullName: string;
  username: string;
  /** Every child belongs to a tổ: the class list asks for one. */
  group: number;
  avatarEmoji: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  /** Net points: plus minus minus. */
  points: number;
  /** Drops earned (plus points only). Drives the level. */
  drops: number;
  weekPoints: number;
  level: number;
}

export interface NewAccount {
  id: number;
  fullName: string;
  username: string;
  group: number;
  /** The password to hand to the family. The teacher can read it back at any time. */
  password: string;
}

/** A row of the printable account slips, and of the teacher's "Tài khoản cả lớp" list. */
export interface AccountSlip {
  id: number;
  fullName: string;
  username: string;
  group: number;
  password: string;
  /** True once the child (or a parent) has set their own password in place of the generated one. */
  chosenByChild: boolean;
}

export interface Reason {
  id: number;
  label: string;
  emoji: string;
  category: PointCategory;
  kind: "plus" | "minus";
  /** What it is worth (brief 7): always positive, the sign is `kind`. "Chăm chỉ" +2, "Không làm BT" −2. */
  drops: number;
}

export interface PointEvent {
  id: number;
  studentId: number;
  studentName: string;
  delta: number;
  reason: string;
  emoji: string | null;
  category: PointCategory;
  source: "manual" | "task" | "badge";
  batchId: string | null;
  createdAt: string;
}

export interface LeaderRow {
  studentId: number;
  fullName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  group: number | null;
  points: number;
}

export interface ClassOverview {
  class: ClassDetail;
  students: StudentRow[];
  reasons: Reason[];
  weekTop: LeaderRow[];
  recent: PointEvent[];
  recentBadges: { studentId: number; fullName: string; key: string; awardedAt: string }[];
  stats: {
    students: number;
    totalPoints: number;
    todayPoints: number;
    kindness: number;
    openTasks: number;
    pendingRedemptions: number;
    unreadMessages: number;
  };
  schoolWeek: number;
  semester: 1 | 2;
  /** Every badge as this class shows it: her own icon, name and description where she changed them (brief 12). */
  badgeDefs: BadgeDef[];
}

export interface PointsResult {
  events: PointEvent[];
  batchId: string;
  newBadges: { studentId: number; key: string }[];
  /** Students whose level went up with these points. */
  levelUps: { studentId: number; fullName: string; level: number }[];
}

// Tasks -----------------------------------------------------------------------

/**
 * One piece of work the teacher has set. The same shape on both sides: she writes it, the family reads it.
 * Nothing comes back — children do not hand work in through the app.
 */
export interface Task {
  id: number;
  subject: Subject;
  title: string;
  /** What the class is to do. This is the part the family opens the app for. */
  instructions: string;
  status: TaskStatus;
  /** Local date; the work is for the end of that day. */
  dueDate: string | null;
  createdAt: string;
  publishedAt: string | null;
}

// Rewards, badges, communication -----------------------------------------------

export interface Reward {
  id: number;
  name: string;
  emoji: string;
  cost: number;
  active: boolean;
}

export interface Redemption {
  id: number;
  studentId: number;
  fullName: string;
  rewardName: string;
  emoji: string;
  cost: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAt: string;
  decidedAt: string | null;
}

export interface EarnedBadge {
  key: string;
  name: string;
  emoji: string;
  description: string;
  source: "auto" | "teacher";
  note: string | null;
  awardedAt: string;
}

export interface TeacherNote {
  id: number;
  body: string;
  createdAt: string;
}

export interface Message {
  id: number;
  sender: "teacher" | "family";
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface Thread {
  studentId: number;
  fullName: string;
  avatarEmoji: string;
  lastBody: string;
  lastSender: "teacher" | "family";
  lastAt: string;
  unread: number;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
}

export interface Seating {
  rows: number;
  desks: number;
  seatsPerDesk: number;
  seats: Record<string, number>;
}

// Reports -----------------------------------------------------------------------

export interface ReportBucket {
  label: string;
  plus: number;
  minus: number;
}

export interface ReportData {
  period: Period;
  totals: { plus: number; minus: number; net: number; kindness: number };
  buckets: ReportBucket[];
  categories: { category: PointCategory; plus: number; minus: number }[];
  reasons: { reason: string; emoji: string | null; kind: "plus" | "minus"; count: number; points: number }[];
  /** How many tasks she set in each subject over the period. */
  subjects: { subject: Subject; assigned: number }[];
}

export interface ClassReport extends ReportData {
  students: {
    id: number;
    fullName: string;
    avatarEmoji: string;
    group: number | null;
    plus: number;
    minus: number;
    net: number;
  }[];
}

export interface StudentReport extends ReportData {
  events: PointEvent[];
}

export interface StudentProfile {
  student: StudentRow;
  level: LevelInfo;
  available: number;
  badges: EarnedBadge[];
  notes: TeacherNote[];
  rank: number | null;
}

export interface StudentHome {
  me: StudentMe;
  profile: StudentProfile;
  className: string;
  classMotto: string;
  coverUrl: string | null;
  teacherName: string;
  openTasks: Task[];
  announcements: Announcement[];
  recent: PointEvent[];
  weekTop: LeaderRow[] | null;
  unreadMessages: number;
  schoolWeek: number;
}

// The class board -----------------------------------------------------------

export interface BoardMonth {
  /** 'YYYY-MM' on the Vietnam calendar. */
  month: string;
  label: string;
  theme: string;
  note: string;
  emoji: string;
}

/** Brief 13: a child whose family hearted a tile, for the teacher's "Ai đã thích". */
export interface PostLiker {
  studentId: number;
  fullName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  likedAt: string;
}

export interface PostComment {
  id: number;
  author: "teacher" | "family";
  /** The child whose account wrote it; null for the teacher. */
  studentId: number | null;
  authorName: string;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
  /** True when the signed-in account wrote it, so it can offer to delete it. */
  mine: boolean;
}

export interface Post {
  id: number;
  month: string;
  kind: PostKind;
  title: string;
  body: string;
  color: PostColor;
  /** One of POST_STICKERS, or "" for a tile without one. */
  sticker: string;
  layout: PostLayout;
  pinned: boolean;
  dueDate: string | null;
  photos: string[];
  likes: number;
  likedByMe: boolean;
  comments: number;
  createdAt: string;
  updatedAt: string;
}

/** "Sản phẩm của em": a photo of the child's work, put up by the teacher for the family to look at. */
export interface StudentWork {
  id: number;
  title: string;
  /** Served only to this child's account and the class's teacher. */
  url: string;
  createdAt: string;
}

/** "Tệp hồ sơ": a file on a child's Măng non page. The teacher's alone. */
export interface StudentFile {
  id: number;
  name: string;
  /** Bytes. */
  size: number;
  /** Downloads it, as an attachment, to the class's teacher only. */
  url: string;
  createdAt: string;
}

export interface BoardView {
  month: BoardMonth;
  /** Months that already have a theme or a tile, newest first, so the board can be paged. */
  months: string[];
  posts: Post[];
}

// Hồ sơ Măng non ------------------------------------------------------------

export interface ProfileFields {
  birthday: string | null;
  gender: Gender | null;
  hobby: string;
  dream: string;
  /** Chức vụ. Only the teacher sets this one. */
  duty: string;
}

export interface MangNonRow extends ProfileFields {
  id: number;
  /** Day and month of the birthday, "12/03". Classmates see this one; the year is not theirs to know. */
  birthdayDm: string | null;
  fullName: string;
  group: number | null;
  teamName: string | null;
  teamEmoji: string | null;
  avatarEmoji: string;
  avatarUrl: string | null;
}

// Chuyên cần ----------------------------------------------------------------

export interface AttendanceMark {
  studentId: number;
  status: AttendanceStatus;
  note: string;
}

export interface AttendanceCount {
  studentId: number;
  fullName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  group: number | null;
  coMat: number;
  diMuon: number;
  coPhep: number;
  khongPhep: number;
}

export interface AttendanceView {
  day: string;
  /** Marks for `day`, one per child the register has seen. */
  marks: AttendanceMark[];
  period: { kind: PeriodKind; label: string; startDate: string; endDate: string };
  counts: AttendanceCount[];
  /** School days the register was taken over the period. */
  daysTaken: number;
}

export interface StudentAttendance {
  period: { kind: PeriodKind; label: string };
  coMat: number;
  diMuon: number;
  coPhep: number;
  khongPhep: number;
  daysTaken: number;
  recent: { day: string; status: AttendanceStatus; note: string }[];
}

// Vinh danh -----------------------------------------------------------------

export interface Honour {
  id: number;
  studentId: number;
  fullName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  period: HonourPeriod;
  periodKey: string;
  periodLabel: string;
  title: string;
  note: string;
  points: number;
  createdAt: string;
}

/** Who is ahead over a period, so the teacher can crown from the ranking instead of counting by hand. */
export interface HonourBoard {
  period: HonourPeriod;
  periodKey: string;
  periodLabel: string;
  given: Honour[];
  leaders: { studentId: number; fullName: string; avatarEmoji: string; avatarUrl: string | null; group: number | null; points: number }[];
}

/** Kết quả thi đua (brief 12): the school's results for one week or month, highest score first. */
export interface SchoolRanking {
  period: CompetitionPeriod;
  periodKey: string;
  periodLabel: string;
  rows: { name: string; score: number; isOurs: boolean }[];
  /** Teacher only, when this period is empty: the classes from the last results she entered, to start from. */
  lastNames?: { name: string; isOurs: boolean }[];
}

/** A week or month of the school's results she has entered (brief 18: only those are shown to families). */
export interface CompetitionEntry {
  period: CompetitionPeriod;
  periodKey: string;
  periodLabel: string;
}

/** Vinh danh on the family's side (brief 12): where their child stands in the class, and the Top 10 if she allows. */
export interface FamilyHonourBoard {
  period: HonourPeriod;
  periodKey: string;
  periodLabel: string;
  /**
   * `rank` is null while the child has no drops in the period: not last, just not yet ranked. `points` is the
   * period's drops, `total` all of them — "123 giọt nước, Tuần này 20 giọt nước" (brief 15).
   */
  me: { rank: number | null; points: number; total: number; of: number };
  /** null when she has hidden the Top 10 from families (Cài đặt). */
  leaders: (HonourBoard["leaders"][number] & { total: number })[] | null;
}

// Thi đua theo tổ -----------------------------------------------------------

export interface TeamStanding {
  group: number;
  name: string;
  emoji: string;
  members: number;
  plus: number;
  minus: number;
  points: number;
  /** Points per member, so a big tổ does not win by size alone. */
  average: number;
}

export interface TeamRace {
  period: { kind: PeriodKind; label: string; startDate: string; endDate: string };
  standings: TeamStanding[];
}
