/** Vietnam has one time zone, UTC+7, and no daylight saving. Every period is cut on local midnights. */
const OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

export type PeriodKind = "week" | "month" | "semester" | "year";

export interface Bucket {
  label: string;
  /** UTC ISO instants, end exclusive. */
  start: string;
  end: string;
}

export interface Period {
  kind: PeriodKind;
  label: string;
  start: string;
  end: string;
  /** Local calendar dates, both inclusive. */
  startDate: string;
  endDate: string;
  buckets: Bucket[];
}

export interface Semesters {
  hk1Start: string;
  hk1End: string;
  hk2Start: string;
  hk2End: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The local (Vietnam) calendar date of an instant, as YYYY-MM-DD. */
export function localDate(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

/** UTC milliseconds of local midnight at the start of `date`. */
function midnightMs(date: string): number {
  const { y, m, d } = parseDate(date);
  return Date.UTC(y, m - 1, d) - OFFSET_MS;
}

export function localMidnightUtc(date: string): string {
  return new Date(midnightMs(date)).toISOString();
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
function weekday(date: string): number {
  const { y, m, d } = parseDate(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

const dm = (date: string) => {
  const { m, d } = parseDate(date);
  return `${pad(d)}/${pad(m)}`;
};

function bucket(label: string, startDate: string, endExclusive: string): Bucket {
  return { label, start: localMidnightUtc(startDate), end: localMidnightUtc(endExclusive) };
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function weekPeriod(date: string): Period {
  const monday = addDays(date, -weekday(date));
  const sunday = addDays(monday, 6);
  return {
    kind: "week",
    label: `Tuần ${dm(monday)} – ${dm(sunday)}/${parseDate(sunday).y}`,
    start: localMidnightUtc(monday),
    end: localMidnightUtc(addDays(monday, 7)),
    startDate: monday,
    endDate: sunday,
    buckets: WEEKDAYS.map((label, i) => bucket(label, addDays(monday, i), addDays(monday, i + 1))),
  };
}

export function monthPeriod(date: string): Period {
  const { y, m } = parseDate(date);
  const first = `${y}-${pad(m)}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  const last = addDays(next, -1);
  const buckets: Bucket[] = [];
  let cursor = first;
  while (cursor < next) {
    let end = addDays(cursor, 7 - weekday(cursor));
    if (end > next) end = next;
    buckets.push(bucket(`${parseDate(cursor).d}–${parseDate(addDays(end, -1)).d}/${m}`, cursor, end));
    cursor = end;
  }
  return {
    kind: "month",
    label: `Tháng ${m}/${y}`,
    start: localMidnightUtc(first),
    end: localMidnightUtc(next),
    startDate: first,
    endDate: last,
    buckets,
  };
}

export function semesterPeriod(sem: Semesters, which: 1 | 2, schoolYear: string): Period {
  const startDate = which === 1 ? sem.hk1Start : sem.hk2Start;
  const endDate = which === 1 ? sem.hk1End : sem.hk2End;
  const endExclusive = addDays(endDate, 1);
  const buckets: Bucket[] = [];
  let cursor = startDate;
  while (cursor < endExclusive) {
    const { y, m } = parseDate(cursor);
    let end = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    if (end > endExclusive) end = endExclusive;
    buckets.push(bucket(`T${m}`, cursor, end));
    cursor = end;
  }
  return {
    kind: "semester",
    label: `Học kỳ ${which === 1 ? "I" : "II"} (${schoolYear.replace("-", "–")})`,
    start: localMidnightUtc(startDate),
    end: localMidnightUtc(endExclusive),
    startDate,
    endDate,
    buckets,
  };
}

/** The usual calendar: school opens on 5 September; semester II starts in mid-January and ends in May. */
export function defaultSemesters(startYear: number): Semesters {
  return {
    hk1Start: `${startYear}-09-05`,
    hk1End: `${startYear + 1}-01-17`,
    hk2Start: `${startYear + 1}-01-18`,
    hk2End: `${startYear + 1}-05-31`,
  };
}

export function currentSemester(sem: Semesters, today: string): 1 | 2 {
  return today < sem.hk2Start ? 1 : 2;
}

/**
 * Her school weeks (brief 18): "tuần 1 từ 7-9 đến 11/9; tuần 2 (14/9-18/9) tương tự như thế đến hết tuần 35". Week 1
 * starts on the first Monday on or after the first day of semester I — school opens on Saturday 5 September, so
 * Tuần 1 is Monday 7 to Friday 11 September. A Saturday or Sunday belongs to the week before it.
 */
export const SCHOOL_WEEKS = 35;

function firstSchoolMonday(sem: Semesters): string {
  const wd = weekday(sem.hk1Start);
  // A Monday-to-Friday start is that week; a weekend start waits for the Monday after.
  return wd <= 4 ? addDays(sem.hk1Start, -wd) : addDays(sem.hk1Start, 7 - wd);
}

export interface SchoolWeek {
  n: number;
  monday: string;
  friday: string;
  /** "Tuần 1 (07/09 – 11/09)". */
  label: string;
}

function schoolWeekN(sem: Semesters, n: number): SchoolWeek {
  const monday = addDays(firstSchoolMonday(sem), (n - 1) * 7);
  const friday = addDays(monday, 4);
  return { n, monday, friday, label: `Tuần ${n} (${dm(monday)} – ${dm(friday)})` };
}

/** Tuần 1 to Tuần 35. */
export function schoolWeeks(sem: Semesters): SchoolWeek[] {
  return Array.from({ length: SCHOOL_WEEKS }, (_, i) => schoolWeekN(sem, i + 1));
}

/** School week number of a date. 0 before Tuần 1 and after semester II; past Tuần 35 it keeps counting to the end. */
export function schoolWeek(sem: Semesters, today: string): number {
  const first = firstSchoolMonday(sem);
  if (today < first || today > sem.hk2End) return 0;
  return Math.floor((midnightMs(today) - midnightMs(first)) / (7 * DAY_MS)) + 1;
}

/** The named week a date falls in, or null outside Tuần 1–35. */
export function schoolWeekOf(sem: Semesters, date: string): SchoolWeek | null {
  const first = firstSchoolMonday(sem);
  if (date < first) return null;
  const n = Math.floor((midnightMs(date) - midnightMs(first)) / (7 * DAY_MS)) + 1;
  return n >= 1 && n <= SCHOOL_WEEKS ? schoolWeekN(sem, n) : null;
}

/**
 * "Tuần trước" (brief 18): the latest school week that has finished — on a Saturday or Sunday the one just ended,
 * on a school day the one before. Before Tuần 1 has finished, Tuần 1; after Tuần 35, Tuần 35.
 */
export function lastSchoolWeek(sem: Semesters, today: string): SchoolWeek | null {
  const first = firstSchoolMonday(sem);
  const days = Math.floor((midnightMs(today) - midnightMs(first)) / DAY_MS);
  const weeks = Math.floor(days / 7);
  const finished = weekday(today) >= 5 ? weeks + 1 : weeks;
  return schoolWeekN(sem, Math.min(SCHOOL_WEEKS, Math.max(1, finished)));
}

/** The whole school year, from the first day of semester I to the last of semester II, bucketed by month. */
export function yearPeriod(sem: Semesters, schoolYear: string): Period {
  const endExclusive = addDays(sem.hk2End, 1);
  const buckets: Bucket[] = [];
  let cursor = sem.hk1Start;
  while (cursor < endExclusive) {
    const { y, m } = parseDate(cursor);
    let end = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    if (end > endExclusive) end = endExclusive;
    buckets.push(bucket(`T${m}`, cursor, end));
    cursor = end;
  }
  return {
    kind: "year",
    label: `Năm học ${schoolYear.replace("-", "–")}`,
    start: localMidnightUtc(sem.hk1Start),
    end: localMidnightUtc(endExclusive),
    startDate: sem.hk1Start,
    endDate: sem.hk2End,
    buckets,
  };
}

/** 'YYYY-MM' of a local date: which month's board a tile belongs to. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** A readable month for the board's heading. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/** The month before or after `month` ('YYYY-MM'), so the board can be paged through. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y! * 12 + (m! - 1) + by;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}
