import { describe, expect, it } from "vitest";
import { parseStudentList, tidyName } from "../src/student-list";

describe("tidyName", () => {
  it("collapses spaces and title-cases names typed in all caps or all lower case", () => {
    expect(tidyName("  NGUYỄN   VĂN AN ")).toBe("Nguyễn Văn An");
    expect(tidyName("trần bảo ngọc")).toBe("Trần Bảo Ngọc");
  });

  it("keeps mixed case as the teacher typed it", () => {
    expect(tidyName("Hồ Quốc Bảo")).toBe("Hồ Quốc Bảo");
  });
});

describe("parseStudentList", () => {
  it("reads one student per line and skips blank lines", () => {
    const r = parseStudentList("Nguyễn Văn An\n\nTrần Bảo Ngọc\r\n  Lê Linh Đan  \n");
    expect(r.errors).toEqual([]);
    expect(r.students.map((s) => s.fullName)).toEqual(["Nguyễn Văn An", "Trần Bảo Ngọc", "Lê Linh Đan"]);
    expect(r.students.every((s) => s.group === null)).toBe(true);
  });

  it("drops the numbering a class list pasted from Word or Excel carries", () => {
    const r = parseStudentList("1. Nguyễn Văn An\n2) Trần Bảo Ngọc\n03 - Lê Linh Đan\n4\tPhạm Đức Huy");
    expect(r.students.map((s) => s.fullName)).toEqual(["Nguyễn Văn An", "Trần Bảo Ngọc", "Lê Linh Đan", "Phạm Đức Huy"]);
  });

  it("reads an optional group (tổ) after a tab, comma or semicolon", () => {
    const r = parseStudentList("Nguyễn Văn An, 1\nTrần Bảo Ngọc\t2\nLê Linh Đan; Tổ 3\n5\tPhạm Đức Huy\t4");
    expect(r.students.map((s) => [s.fullName, s.group])).toEqual([
      ["Nguyễn Văn An", 1],
      ["Trần Bảo Ngọc", 2],
      ["Lê Linh Đan", 3],
      ["Phạm Đức Huy", 4],
    ]);
  });

  it("skips a header row such as 'STT  Họ và tên'", () => {
    const r = parseStudentList("STT\tHọ và tên\tTổ\n1\tNguyễn Văn An\t1");
    expect(r.students.map((s) => s.fullName)).toEqual(["Nguyễn Văn An"]);
    expect(r.errors).toEqual([]);
  });

  it("reports lines that hold no name, with their line number", () => {
    const r = parseStudentList("Nguyễn Văn An\n12345\nA");
    expect(r.students).toHaveLength(1);
    expect(r.errors).toEqual([
      { line: 2, text: "12345", message: "Dòng này không có tên học sinh." },
      { line: 3, text: "A", message: "Tên quá ngắn." },
    ]);
  });

  it("rejects names longer than 60 characters", () => {
    const r = parseStudentList("Nguyễn " + "Văn ".repeat(20) + "An");
    expect(r.errors[0]?.message).toBe("Tên dài quá 60 ký tự.");
  });
});

describe("class lists as schools actually export them", () => {
  it("skips a header row that starts with STT, whatever columns follow", () => {
    const r = parseStudentList("STT\tHọ và tên\tNgày sinh\tGiới tính\n1\tNguyễn Văn An\t12/03/2017\tNam");
    expect(r.students.map((s) => s.fullName)).toEqual(["Nguyễn Văn An"]);
  });

  it("skips title lines such as 'DANH SÁCH HỌC SINH LỚP 4A' and 'Năm học 2026 - 2027'", () => {
    const r = parseStudentList("DANH SÁCH HỌC SINH LỚP 4A\nNăm học 2026 - 2027\nNguyễn Văn An\nTrần Bảo Ngọc");
    expect(r.students.map((s) => s.fullName)).toEqual(["Nguyễn Văn An", "Trần Bảo Ngọc"]);
    expect(r.errors).toEqual([]);
  });

  it("reads a group typed after the name with a space or a dash", () => {
    const r = parseStudentList("Nguyễn Văn An 2\nTrần Bảo Ngọc - Tổ 3\nLê Minh Đức tổ 1");
    expect(r.students.map((s) => [s.fullName, s.group])).toEqual([
      ["Nguyễn Văn An", 2],
      ["Trần Bảo Ngọc", 3],
      ["Lê Minh Đức", 1],
    ]);
  });

  it("takes the dash Word makes of a hyphen, so no name keeps a stray — or –", () => {
    const r = parseStudentList("Nguyễn Văn An — Tổ 2\nTrần Bảo Ngọc – tổ 3\nLê Minh Đức — 1");
    expect(r.students.map((s) => [s.fullName, s.group])).toEqual([
      ["Nguyễn Văn An", 2],
      ["Trần Bảo Ngọc", 3],
      ["Lê Minh Đức", 1],
    ]);
  });

  it("reads a birth date in a column after the name, and ignores the columns it doesn't know", () => {
    const r = parseStudentList("1\tNguyễn Văn An\t12/03/2017\tNam");
    expect(r.students).toEqual([{ fullName: "Nguyễn Văn An", group: null, birthday: "2017-03-12", line: 1 }]);
  });
});

/** Brief 6: the username is made from the day of birth, so the class list carries it. */
describe("birth dates in the class list", () => {
  it("takes the ways a Vietnamese list writes a date", () => {
    const r = parseStudentList(
      [
        "Nguyễn Thị Minh Anh, 27/03/2016, 2",
        "Trần Hoài An\t22-11-2016\tTổ 1",
        "Lê Thị Ngọc Ánh; 1.5.2016; 3",
        "Phạm Gia Hân, 2016-08-09, 1",
      ].join("\n"),
    );
    expect(r.errors).toEqual([]);
    expect(r.students.map((s) => [s.fullName, s.birthday, s.group])).toEqual([
      ["Nguyễn Thị Minh Anh", "2016-03-27", 2],
      ["Trần Hoài An", "2016-11-22", 1],
      ["Lê Thị Ngọc Ánh", "2016-05-01", 3],
      ["Phạm Gia Hân", "2016-08-09", 1],
    ]);
  });

  it("finds a date typed straight after the name, with no comma", () => {
    const r = parseStudentList("Nguyễn Thị Minh Anh 27/03/2016 - Tổ 2\nTrần Hoài An 22/11/2016");
    expect(r.students.map((s) => [s.fullName, s.birthday, s.group])).toEqual([
      ["Nguyễn Thị Minh Anh", "2016-03-27", 2],
      ["Trần Hoài An", "2016-11-22", null],
    ]);
  });

  it("has no birthday when the line has none, and refuses a date that doesn't exist", () => {
    const r = parseStudentList("Nguyễn Văn An, 1\nTrần Bảo Ngọc, 31/02/2016, 2");
    expect(r.students[0]!.birthday).toBeNull();
    expect(r.students).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 2, message: "Ngày sinh 31/02/2016 không có thật." });
  });
});
