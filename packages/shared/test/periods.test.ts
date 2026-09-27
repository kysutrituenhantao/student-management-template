import { describe, expect, it } from "vitest";
import {
  currentSemester,
  defaultSemesters,
  localDate,
  localMidnightUtc,
  monthPeriod,
  lastSchoolWeek,
  schoolWeek,
  schoolWeekOf,
  schoolWeeks,
  semesterPeriod,
  weekPeriod,
} from "../src/periods";

describe("Vietnam time (UTC+7)", () => {
  it("reads the local calendar date from a UTC instant", () => {
    expect(localDate(new Date("2026-09-20T16:59:00Z"))).toBe("2026-09-20");
    expect(localDate(new Date("2026-09-20T17:00:00Z"))).toBe("2026-09-21");
  });

  it("turns a local date into the UTC instant of its midnight", () => {
    expect(localMidnightUtc("2026-09-21")).toBe("2026-09-20T17:00:00.000Z");
  });
});

describe("weekPeriod", () => {
  it("runs Monday to Sunday, local time, with one bucket per day", () => {
    const p = weekPeriod("2026-09-23"); // a Wednesday
    expect(p.start).toBe("2026-09-20T17:00:00.000Z");
    expect(p.end).toBe("2026-09-27T17:00:00.000Z");
    expect(p.startDate).toBe("2026-09-21");
    expect(p.endDate).toBe("2026-09-27");
    expect(p.label).toBe("Tuần 21/09 – 27/09/2026");
    expect(p.buckets.map((b) => b.label)).toEqual(["T2", "T3", "T4", "T5", "T6", "T7", "CN"]);
    expect(p.buckets[0]).toMatchObject({ start: "2026-09-20T17:00:00.000Z", end: "2026-09-21T17:00:00.000Z" });
  });

  it("treats Sunday as the end of its week", () => {
    expect(weekPeriod("2026-09-27").startDate).toBe("2026-09-21");
    expect(weekPeriod("2026-09-28").startDate).toBe("2026-09-28");
  });
});

describe("monthPeriod", () => {
  it("covers the calendar month with Monday-based week buckets clipped to the month", () => {
    const p = monthPeriod("2026-09-23");
    expect(p.label).toBe("Tháng 9/2026");
    expect(p.startDate).toBe("2026-09-01");
    expect(p.endDate).toBe("2026-09-30");
    expect(p.buckets.map((b) => b.label)).toEqual(["1–6/9", "7–13/9", "14–20/9", "21–27/9", "28–30/9"]);
  });

  it("rolls December into January", () => {
    const p = monthPeriod("2026-12-10");
    expect(p.end).toBe(localMidnightUtc("2027-01-01"));
  });
});

describe("semesters", () => {
  const sem = defaultSemesters(2026);

  it("defaults to the usual Vietnamese school calendar", () => {
    expect(sem).toEqual({ hk1Start: "2026-09-05", hk1End: "2027-01-17", hk2Start: "2027-01-18", hk2End: "2027-05-31" });
  });

  it("picks the semester a date falls in", () => {
    expect(currentSemester(sem, "2026-10-01")).toBe(1);
    expect(currentSemester(sem, "2027-01-18")).toBe(2);
    expect(currentSemester(sem, "2027-07-01")).toBe(2);
  });

  it("buckets a semester by month, clipped to its dates", () => {
    const p = semesterPeriod(sem, 1, "2026-2027");
    expect(p.label).toBe("Học kỳ I (2026–2027)");
    expect(p.startDate).toBe("2026-09-05");
    expect(p.endDate).toBe("2027-01-17");
    expect(p.buckets.map((b) => b.label)).toEqual(["T9", "T10", "T11", "T12", "T1"]);
    expect(p.buckets[0]!.start).toBe(localMidnightUtc("2026-09-05"));
    expect(p.buckets[4]!.end).toBe(localMidnightUtc("2027-01-18"));
  });

  // Brief 18: "tuần 1 từ 7-9 đến 11/9; tuần 2 (14/9-18/9) tương tự như thế đến hết tuần 35".
  it("numbers school weeks her way: week 1 is the first Monday on or after the first day of semester I", () => {
    expect(schoolWeek(sem, "2026-09-05")).toBe(0); // the Saturday school opens: before Tuần 1
    expect(schoolWeek(sem, "2026-09-07")).toBe(1);
    expect(schoolWeek(sem, "2026-09-11")).toBe(1);
    expect(schoolWeek(sem, "2026-09-13")).toBe(1); // the weekend belongs to the week before it
    expect(schoolWeek(sem, "2026-09-14")).toBe(2);
    expect(schoolWeek(sem, "2026-09-27")).toBe(3);
    expect(schoolWeek(sem, "2026-09-01")).toBe(0);
  });
});

describe("schoolWeeks (brief 18)", () => {
  const sem = defaultSemesters(2026);
  it("is thirty-five weeks, Monday to Friday, named the way she writes them", () => {
    const weeks = schoolWeeks(sem);
    expect(weeks).toHaveLength(35);
    expect(weeks[0]).toEqual({ n: 1, monday: "2026-09-07", friday: "2026-09-11", label: "Tuần 1 (07/09 – 11/09)" });
    expect(weeks[1]).toMatchObject({ n: 2, monday: "2026-09-14", label: "Tuần 2 (14/09 – 18/09)" });
    expect(weeks[34]!.n).toBe(35);
  });

  it("names the week a date falls in, and gives nothing outside the thirty-five", () => {
    expect(schoolWeekOf(sem, "2026-09-23")!.label).toBe("Tuần 3 (21/09 – 25/09)");
    expect(schoolWeekOf(sem, "2026-09-26")!.n).toBe(3);
    expect(schoolWeekOf(sem, "2026-09-05")).toBeNull();
  });

  it("'tuần trước' is the latest school week that has finished", () => {
    // A Sunday or a Saturday: the week that has just ended.
    expect(lastSchoolWeek(sem, "2026-09-27")!.n).toBe(3);
    expect(lastSchoolWeek(sem, "2026-09-26")!.n).toBe(3);
    // A school day: the week before this one.
    expect(lastSchoolWeek(sem, "2026-09-28")!.n).toBe(3);
    expect(lastSchoolWeek(sem, "2026-09-25")!.n).toBe(2);
    // Before any week has finished there is none; the first one is the closest.
    expect(lastSchoolWeek(sem, "2026-09-08")!.n).toBe(1);
  });
});

describe("schoolWeek after the school year", () => {
  it("is 0 once semester II has ended", () => {
    const sem = defaultSemesters(2026);
    expect(schoolWeek(sem, "2027-05-31")).toBeGreaterThan(35);
    expect(schoolWeek(sem, "2027-06-01")).toBe(0);
  });
});
