import { describe, expect, it } from "vitest";
import { firstName, formatLocalDate, signed, timeAgo, todayLocal } from "@/lib/format";

describe("format", () => {
  it("signs point changes with a real minus sign", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(-2)).toBe("−2");
    expect(signed(0)).toBe("0");
  });

  it("says how long ago, in Vietnamese", () => {
    const now = new Date("2026-09-23T10:00:00Z");
    expect(timeAgo("2026-09-23T09:59:30Z", now)).toBe("vừa xong");
    expect(timeAgo("2026-09-23T09:15:00Z", now)).toBe("45 phút trước");
    expect(timeAgo("2026-09-23T05:00:00Z", now)).toBe("5 giờ trước");
    expect(timeAgo("2026-09-22T08:00:00Z", now)).toBe("hôm qua");
  });

  it("reads today's date on Vietnam time", () => {
    expect(todayLocal(new Date("2026-09-22T17:30:00Z"))).toBe("2026-09-23");
  });

  it("formats local dates and first names the Vietnamese way", () => {
    expect(formatLocalDate("2026-09-05")).toBe("05/09/2026");
    expect(firstName("Nguyễn Thị Minh Anh")).toBe("Anh");
  });
});
