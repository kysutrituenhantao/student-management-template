import { z } from "zod";

/**
 * Plain Vietnamese for any rule a schema doesn't word itself, so a teacher never sees "expected int, received number".
 * A message written on the schema always wins over these.
 */
z.config({
  customError: (iss) => {
    switch (iss.code) {
      case "too_big":
        if (iss.origin === "string") return `Tối đa ${iss.maximum} ký tự.`;
        if (iss.origin === "array" || iss.origin === "set") return `Tối đa ${iss.maximum} mục.`;
        return `Tối đa ${iss.maximum}.`;
      case "too_small":
        if (iss.origin === "string") return Number(iss.minimum) <= 1 ? "Không được để trống." : `Cần ít nhất ${iss.minimum} ký tự.`;
        if (iss.origin === "array" || iss.origin === "set") return `Cần ít nhất ${iss.minimum} mục.`;
        return `Ít nhất ${iss.minimum}.`;
      case "invalid_type":
        if (iss.expected === "int") return "Hãy nhập một số nguyên.";
        if (iss.expected === "number") return "Hãy nhập một số.";
        return iss.input === undefined ? "Thiếu thông tin." : "Dữ liệu không hợp lệ.";
      case "invalid_value":
        return "Lựa chọn không hợp lệ.";
      case "invalid_format":
        return "Định dạng không hợp lệ.";
      default:
        return "Dữ liệu không hợp lệ.";
    }
  },
});
