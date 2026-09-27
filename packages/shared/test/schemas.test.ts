import { describe, expect, it } from "vitest";
import { changePasswordInput, classInput, imageInput, pointsInput, studentsCreateInput, taskInput } from "../src/schemas";
import { studentFileExt } from "../src/constants";

describe("studentFileExt (Tệp hồ sơ, brief 5)", () => {
  it("knows Word, Excel, PowerPoint, PDF and photos, whatever the case of the extension", () => {
    expect(studentFileExt("Phiếu thông tin An.DOCX")).toBe("docx");
    expect(studentFileExt("diem.xls")).toBe("xls");
    expect(studentFileExt("giay.khai.sinh.pdf")).toBe("pdf");
    expect(studentFileExt("anh.JPEG")).toBe("jpeg");
  });

  it("refuses anything else, and a name with no extension at all", () => {
    expect(studentFileExt("cai-dat.exe")).toBeNull();
    expect(studentFileExt("trang.html")).toBeNull();
    expect(studentFileExt("docx")).toBeNull();
    expect(studentFileExt("")).toBeNull();
  });
});

describe("changePasswordInput", () => {
  it("refuses a new password that is the old one", () => {
    const r = changePasswordInput.safeParse({ currentPassword: "k9mp42", newPassword: "k9mp42" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Mật khẩu mới phải khác mật khẩu cũ.");
  });

  it("needs at least 6 characters", () => {
    expect(changePasswordInput.safeParse({ currentPassword: "abcd1234", newPassword: "12345" }).success).toBe(false);
    expect(changePasswordInput.safeParse({ currentPassword: "abcd1234", newPassword: "meo123" }).success).toBe(true);
  });
});

describe("classInput", () => {
  it("fills in sensible defaults", () => {
    const r = classInput.parse({ name: "Lớp 4A", grade: 4, schoolYear: "2026-2027", usernameSuffix: "2026" });
    expect(r).toMatchObject({ motto: "", groupCount: 4, showLeaderboard: true, coverShade: 0.35 });
  });

  it("wants a school year like 2026-2027", () => {
    expect(classInput.safeParse({ name: "4A", grade: 4, schoolYear: "2026-2028", usernameSuffix: "2026" }).success).toBe(false);
  });
});

describe("pointsInput", () => {
  it("scores without a reason, as a tap on a sticker does", () => {
    expect(pointsInput.safeParse({ studentIds: [1], delta: 1 }).success).toBe(true);
  });

  it("rejects zero and out-of-range points", () => {
    expect(pointsInput.safeParse({ studentIds: [1], delta: 0 }).success).toBe(false);
    expect(pointsInput.safeParse({ studentIds: [1], delta: 50 }).success).toBe(false);
  });
});

describe("taskInput", () => {
  const base = { subject: "toan", title: "Luyện tập phép cộng" };

  it("takes a subject, a title and what to do", () => {
    const r = taskInput.parse({ ...base, instructions: "Làm bài 3, 4 trang 45." });
    expect(r).toMatchObject({ subject: "toan", title: "Luyện tập phép cộng", instructions: "Làm bài 3, 4 trang 45." });
  });

  it("is published with no due date unless she sets one", () => {
    expect(taskInput.parse(base)).toMatchObject({ status: "published", dueDate: null, instructions: "" });
    expect(taskInput.parse({ ...base, dueDate: "2026-09-25" }).dueDate).toBe("2026-09-25");
  });

  it("needs a title", () => {
    expect(taskInput.safeParse({ ...base, title: "  " }).success).toBe(false);
  });
});

describe("groupsInput", () => {
  it("moves several children into a tổ at once", async () => {
    const { groupsInput } = await import("../src/schemas");
    expect(groupsInput.safeParse({ moves: [{ studentId: 3, group: 2 }, { studentId: 4, group: 2 }] }).success).toBe(true);
  });

  it("refuses an empty save, a tổ the class cannot have, and a child left without one", async () => {
    const { groupsInput } = await import("../src/schemas");
    expect(groupsInput.safeParse({ moves: [] }).success).toBe(false);
    expect(groupsInput.safeParse({ moves: [{ studentId: 3, group: 9 }] }).success).toBe(false);
    // Every child belongs to a tổ: there is no way to ask for none.
    expect(groupsInput.safeParse({ moves: [{ studentId: 3, group: null }] }).success).toBe(false);
    expect(groupsInput.safeParse({ moves: [{ studentId: 3, group: 0 }] }).success).toBe(false);
  });
});

describe("studentsCreateInput", () => {
  it("caps a bulk add at 60 students", () => {
    const students = Array.from({ length: 61 }, (_, i) => ({ fullName: `Học Sinh ${i}` }));
    expect(studentsCreateInput.safeParse({ students }).success).toBe(false);
  });
});

describe("imageInput", () => {
  it("accepts a base64 WebP, JPEG or PNG data URL only", () => {
    expect(imageInput.safeParse({ dataUrl: "data:image/webp;base64,UklGRg==" }).success).toBe(true);
    expect(imageInput.safeParse({ dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }).success).toBe(false);
    expect(imageInput.safeParse({ dataUrl: "https://example.com/a.png" }).success).toBe(false);
  });
});

describe("dateField", () => {
  it("refuses dates that don't exist", async () => {
    const { dateField } = await import("../src/schemas");
    expect(dateField.safeParse("2027-02-29").success).toBe(false);
    expect(dateField.safeParse("2026-13-01").success).toBe(false);
    expect(dateField.safeParse("2028-02-29").success).toBe(true);
  });
});

describe("BADGE_BY_KEY", () => {
  it("finds nothing for prototype names sent in a request", async () => {
    const { BADGE_BY_KEY } = await import("../src/progress");
    expect(BADGE_BY_KEY["constructor"]).toBeUndefined();
    expect(BADGE_BY_KEY["__proto__"]).toBeUndefined();
    expect(BADGE_BY_KEY["reader"]?.name).toBe("Mọt sách nhí");
  });
});
