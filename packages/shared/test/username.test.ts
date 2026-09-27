import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, DEFAULT_STUDENT_PASSWORD, USERNAME_CODE_LENGTH } from "../src/constants";
import { givenName, newStudentPassword, newUsername, normalizeUsername, pickUsername, randomCode, stripDiacritics, usernameFor, usernameStem } from "../src/username";

describe("stripDiacritics", () => {
  it("removes Vietnamese tone and vowel marks, including đ", () => {
    expect(stripDiacritics("Nguyễn Thị Ánh Đào")).toBe("Nguyen Thi Anh Dao");
    expect(stripDiacritics("Trương Quốc Hưng, Lê Ngọc Ước")).toBe("Truong Quoc Hung, Le Ngoc Uoc");
  });

  it("handles decomposed input the same as precomposed", () => {
    expect(stripDiacritics("Ánh")).toBe("Anh");
  });
});

describe("givenName", () => {
  it("is the last word of a Vietnamese full name", () => {
    expect(givenName("Nguyễn Văn An")).toBe("An");
    expect(givenName("  Trần   Bảo  Ngọc ")).toBe("Ngọc");
    expect(givenName("Mai")).toBe("Mai");
  });
});

describe("normalizeUsername", () => {
  it("ignores case, spaces, dots and diacritics, so 'an.k7m4' and 'AN K7M4' reach the same account", () => {
    expect(normalizeUsername("an.k7m4")).toBe("ank7m4");
    expect(normalizeUsername("  AN K7M4 ")).toBe("ank7m4");
    expect(normalizeUsername("Ánh.k7m4")).toBe("anhk7m4");
    expect(normalizeUsername("Đạt.k7m4")).toBe("datk7m4");
  });
});

describe("usernameStem", () => {
  it("is the given name in plain lowercase letters", () => {
    expect(usernameStem("Nguyễn Văn An")).toBe("an");
    expect(usernameStem("Trần Thị Ánh")).toBe("anh");
    expect(usernameStem("Lê Minh Đức")).toBe("duc");
    expect(usernameStem("Mai")).toBe("mai");
  });

  it("never takes a number as the given name, and never comes back empty", () => {
    expect(usernameStem("Nguyễn Văn An 2")).toBe("an");
    expect(usernameStem("!!!")).toBe("hocsinh");
  });
});

describe("randomCode", () => {
  it("draws only characters a child can't misread", () => {
    for (let i = 0; i < 200; i++) {
      const code = randomCode(6);
      expect(code).toHaveLength(6);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 300 }, () => randomCode(6)));
    expect(seen.size).toBeGreaterThan(290);
  });
});

describe("newUsername", () => {
  it("is the given name, a dot, and characters that keep two children called An apart", () => {
    const a = newUsername("Nguyễn Văn An");
    const b = newUsername("Trần Thị An");
    expect(a).toMatch(new RegExp(`^an\\.[${CODE_ALPHABET}]{${USERNAME_CODE_LENGTH}}$`));
    expect(a).not.toBe(b);
  });

  it("writes nothing a Vietnamese keyboard is needed for", () => {
    expect(newUsername("Nguyễn Thị Đông Đào")).toMatch(/^dao\./);
    expect(newUsername("Trần Thị Bưởi")).toMatch(/^buoi\./);
  });
});

describe("newStudentPassword", () => {
  it("is six characters from the same safe alphabet", () => {
    const p = newStudentPassword();
    expect(p).toHaveLength(6);
    for (const ch of p) expect(CODE_ALPHABET).toContain(ch);
  });
});

/**
 * Brief 6: "Tạo tài khoản và mật khẩu học sinh tự động theo mẫu: tên lót-tên-ngày sinh. Ví dụ: minhanh27; hoaian22;
 * ngocanh01. Mật khẩu: Abc12345".
 */
describe("usernameFor (tên lót + tên + ngày sinh)", () => {
  it("is her three examples", () => {
    expect(usernameFor("Nguyễn Thị Minh Anh", "2016-03-27")).toBe("minhanh27");
    expect(usernameFor("Trần Hoài An", "2016-11-22")).toBe("hoaian22");
    expect(usernameFor("Lê Thị Ngọc Ánh", "2016-05-01")).toBe("ngocanh01");
  });

  it("takes only the given name when the name has no middle name", () => {
    expect(usernameFor("Lê An", "2016-05-09")).toBe("an09");
  });

  it("is the name alone while the birthday is not known yet", () => {
    expect(usernameFor("Phạm Gia Hân", null)).toBe("giahan");
  });

  it("drops marks, đ, and anything that is not a letter", () => {
    expect(usernameFor("Đỗ Đức Đạt 2", "2016-12-31")).toBe("ducdat31");
    expect(usernameFor("!!!", null)).toBe("hocsinh");
  });
});

describe("pickUsername", () => {
  it("is the pattern when nobody has it", () => {
    expect(pickUsername("minhanh27", new Set())).toBe("minhanh27");
  });

  it("puts a letter after it when it is taken, and keeps going", () => {
    expect(pickUsername("minhanh27", new Set(["minhanh27"]))).toBe("minhanh27b");
    expect(pickUsername("minhanh27", new Set(["minhanh27", "minhanh27b"]))).toBe("minhanh27c");
    const taken = new Set(["an"]);
    for (let i = 0; i < 60; i++) taken.add(pickUsername("an", taken));
    expect(taken.size).toBe(61);
  });
});

describe("DEFAULT_STUDENT_PASSWORD", () => {
  it("is hers", () => {
    expect(DEFAULT_STUDENT_PASSWORD).toBe("Abc12345");
  });
});
