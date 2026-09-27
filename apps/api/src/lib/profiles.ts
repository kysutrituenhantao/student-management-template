import type { Gender, MangNonRow, Team } from "@lhhp/shared";
import { avatarUrl } from "./media";

type Row = Record<string, unknown>;

export const MANG_NON_SELECT = `SELECT s.id, s.full_name, s.group_no, s.avatar_emoji, s.avatar_version, s.has_photo,
  s.birthday, s.gender, s.hobby, s.dream, s.duty FROM students s`;

export function toMangNonRow(r: Row, teams: Team[]): MangNonRow {
  const group = r.group_no === null || r.group_no === undefined ? null : Number(r.group_no);
  const team = group ? teams[group - 1] : undefined;
  return {
    id: Number(r.id),
    fullName: String(r.full_name),
    group,
    teamName: team?.name ?? null,
    teamEmoji: team?.emoji ?? null,
    avatarEmoji: String(r.avatar_emoji),
    avatarUrl: avatarUrl(Number(r.id), Number(r.avatar_version ?? 0), Number(r.has_photo ?? 0) === 1),
    birthday: (r.birthday as string | null) ?? null,
    birthdayDm: r.birthday ? `${String(r.birthday).slice(8, 10)}/${String(r.birthday).slice(5, 7)}` : null,
    gender: (r.gender as Gender | null) ?? null,
    hobby: String(r.hobby ?? ""),
    dream: String(r.dream ?? ""),
    duty: String(r.duty ?? ""),
  };
}

/**
 * What classmates may see of each other: the day and month of a birthday, never the year. A child sees their own
 * full date, and so does the teacher.
 */
export function hideBirthYear(row: MangNonRow): MangNonRow {
  return { ...row, birthday: null };
}
