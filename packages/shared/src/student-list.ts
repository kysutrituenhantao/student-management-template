export interface ParsedStudent {
  fullName: string;
  /** Tổ (group) number, when the pasted line gives one. */
  group: number | null;
  /** Date of birth as YYYY-MM-DD, when the line gives one. The username is made from its day (brief 6). */
  birthday: string | null;
  line: number;
}

export interface ParseError {
  line: number;
  text: string;
  message: string;
}

export const MAX_NAME_LENGTH = 60;

const HAS_LETTER = /\p{L}/u;
const NUMBERING = /^\d{1,3}\s*[.)\-:]?\s+/;
const GROUP_CELL = /^(?:tổ|to|t)?\s*(\d{1,2})$/iu;
const HEADER_WORDS = /^(stt|tt|họ và tên|họ tên|ho va ten|ho ten|tên|ten|tổ|to|số thứ tự|lớp|ghi chú)$/iu;
/** The first cell of a header row: STT, TT, Số TT, Số thứ tự. */
const HEADER_FIRST = /^(stt|tt|số tt|số thứ tự)$/iu;
/** Title lines above a class list: "DANH SÁCH HỌC SINH LỚP 4A", "Năm học 2026 - 2027", "Lớp 4A", "Trường Tiểu học …". */
const TITLE = /^(danh sách|năm học|lớp\s*\d|trường\s|giáo viên chủ nhiệm)/iu;
/**
 * A group written after the name: "Nguyễn Văn An - Tổ 2", "… tổ 2", or a bare "… 2". The dash may be the one Word
 * and Zalo autocorrect a hyphen to (– or —); otherwise it stays stuck on the end of the child's name.
 */
const TRAILING_GROUP = [/\s*(?:[-–—]\s*)?(?:tổ|to)\s*(\d{1,2})$/iu, /\s+[-–—]?\s*(\d{1,2})$/u];

/** 27/03/2016, 27-3-2016, 1.5.2016 — the day first, as Vietnamese lists write it — or 2016-03-27 from a spreadsheet. */
const DATE_CELL = /^(?:(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})|(\d{4})-(\d{2})-(\d{2}))$/;
/** The same date typed straight after the name, with no comma before it. */
const DATE_IN_NAME = /\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}-\d{2}-\d{2})(?=\s|$)/;

/** "27/03/2016" → "2016-03-27"; `false` for a date the calendar doesn't have; null for something that isn't a date. */
function readDate(cell: string): string | false | null {
  const m = cell.match(DATE_CELL);
  if (!m) return null;
  const [d, mo, y] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[5], m[4]];
  const t = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (t.getUTCFullYear() !== Number(y) || t.getUTCMonth() !== Number(mo) - 1 || t.getUTCDate() !== Number(d)) return false;
  return t.toISOString().slice(0, 10);
}

function titleWord(w: string): string {
  const lower = w.toLocaleLowerCase("vi");
  return lower.charAt(0).toLocaleUpperCase("vi") + lower.slice(1);
}

/** Collapses spaces; a name typed all in capitals or all in lower case becomes "Nguyễn Văn An". */
export function tidyName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  const allUpper = name === name.toLocaleUpperCase("vi");
  const allLower = name === name.toLocaleLowerCase("vi");
  return allUpper || allLower ? name.split(" ").map(titleWord).join(" ") : name;
}

/**
 * One student per line, the way Beeclass takes a class list. Accepts what a list pasted from Word or Excel
 * carries: numbering ("1.", "2)", a number column), a header row, an optional group (tổ) column and an optional
 * date of birth.
 */
export function parseStudentList(text: string): { students: ParsedStudent[]; errors: ParseError[] } {
  const students: ParsedStudent[] = [];
  const errors: ParseError[] = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;

    const cells = trimmed
      .split(/\t|[,;|]/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (HEADER_FIRST.test(cells[0]!) || cells.every((c) => HEADER_WORDS.test(c))) return;
    if (TITLE.test(trimmed)) return;

    const nameIndex = cells.findIndex((c) => HAS_LETTER.test(c) && !GROUP_CELL.test(c));
    if (nameIndex === -1) {
      errors.push({ line, text: trimmed, message: "Dòng này không có tên học sinh." });
      return;
    }
    let nameCell = cells[nameIndex]!.replace(NUMBERING, "");
    const inName = nameCell.match(DATE_IN_NAME);
    if (inName && /\p{L}/u.test(nameCell.slice(0, inName.index))) {
      nameCell = nameCell.slice(0, inName.index) + nameCell.slice(inName.index! + inName[0].length);
    }
    const dateText = inName?.[1] ?? cells.find((c, j) => j !== nameIndex && DATE_CELL.test(c));
    const birthday = dateText ? readDate(dateText) : null;
    if (birthday === false) {
      errors.push({ line, text: trimmed, message: `Ngày sinh ${dateText} không có thật.` });
      return;
    }

    let group: number | null = null;
    for (const cell of cells.slice(nameIndex + 1)) {
      const m = cell.match(GROUP_CELL);
      if (m) {
        group = Number(m[1]);
        break;
      }
    }

    if (group === null) {
      for (const re of TRAILING_GROUP) {
        const m = nameCell.match(re);
        if (m && /\p{L}/u.test(nameCell.slice(0, m.index))) {
          group = Number(m[1]);
          nameCell = nameCell.slice(0, m.index);
          break;
        }
      }
    }
    const fullName = tidyName(nameCell);
    if (fullName.replace(/\s/g, "").length < 2) {
      errors.push({ line, text: trimmed, message: "Tên quá ngắn." });
      return;
    }
    if (fullName.length > MAX_NAME_LENGTH) {
      errors.push({ line, text: trimmed, message: `Tên dài quá ${MAX_NAME_LENGTH} ký tự.` });
      return;
    }
    students.push({ fullName, group, birthday, line });
  });

  return { students, errors };
}
