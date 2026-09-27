import { describe, expect, it } from "vitest";
import { z } from "zod";
import { rewardInput } from "../src/schemas";

describe("validation messages", () => {
  const first = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

  it("are Vietnamese, without programming words, when a schema gives none", () => {
    expect(first(rewardInput.safeParse({ name: "Quà", emoji: "🎁", cost: 5000 }))).toBe("Tối đa 1000.");
    expect(first(rewardInput.safeParse({ name: "Quà", emoji: "🎁", cost: 2.5 }))).toBe("Hãy nhập một số nguyên.");
    expect(first(z.string().max(200).safeParse("x".repeat(201)))).toBe("Tối đa 200 ký tự.");
    expect(first(z.enum(["a", "b"]).safeParse("c"))).toBe("Lựa chọn không hợp lệ.");
    expect(first(z.array(z.number()).min(1).safeParse([]))).toBe("Cần ít nhất 1 mục.");
  });

  it("leave a schema's own message alone", () => {
    expect(first(rewardInput.safeParse({ name: "", emoji: "🎁", cost: 5 }))).toBe("Nhập tên phần quà.");
  });
});
