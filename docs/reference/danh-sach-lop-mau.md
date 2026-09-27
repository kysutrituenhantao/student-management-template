# Danh sách lớp mẫu (dữ liệu thử)

Paste-ready class lists for the **"Danh sách lớp, mỗi bạn một dòng"** box (Học sinh → Thêm học sinh), and for trying
the same text through `parseStudentList` in `packages/shared/src/student-list.ts`.

**Every name here is invented.** No real child's name goes in this repo. The lists are built to exercise one parser
rule each, so the preview beside the box can be checked against "Kết quả mong đợi" underneath — each of which was run
through `parseStudentList` and `usernameCandidates` rather than guessed.

A class takes at most **60** children (`MAX_STUDENTS_PER_CLASS`) and a name at most **60** characters
(`MAX_NAME_LENGTH`).

---

## 1. A plain class list, 28 children

The everyday case: one name a line, nothing else.

```
Nguyễn Hà Vy
Trần Quốc Cường
Lê Thanh Trúc
Phạm Minh Quân
Hoàng Diệu Linh
Vũ Đăng Khoa
Đỗ Ngọc Hân
Bùi Tiến Dũng
Phan Yến Nhi
Ngô Hữu Phước
Dương Khánh Ngân
Lý Gia Bảo
Trịnh Tuyết Mai
Đặng Hoàng Phúc
Võ Kim Chi
Hồ Anh Kiệt
Đinh Thuỳ Dương
Lương Bá Thành
Mai Hồng Ánh
Tạ Đức Lâm
Chu Bảo Trâm
Cao Nhật Nam
Hà Mỹ Duyên
Huỳnh Trọng Nghĩa
Vương Lan Chi
Trương Đình Phong
Lâm Tuấn Vũ
Kiều Bích Ngọc
```

**Kết quả mong đợi:** 28 bạn, chưa ai có tổ, tên đăng nhập là **tên gọi bỏ dấu** + đuôi lớp: `Vy2026`, `Cuong2026`,
`Truc2026`, `Han2026`… Hai bạn cùng tên gọi thì bạn sau được thêm chữ cái đầu (xem mục 6).

---

## 2. Tổ written after a comma

The shortcut in the guide: `Tên, số tổ`.

```
Nguyễn Hà Vy, 1
Trần Quốc Cường, 1
Lê Thanh Trúc, 2
Phạm Minh Quân, 2
Hoàng Diệu Linh, 3
Vũ Đăng Khoa, 3
Đỗ Ngọc Hân, 4
Bùi Tiến Dũng, 4
```

**Kết quả mong đợi:** 8 bạn, mỗi tổ 2 bạn. Dấu `;` hoặc `|` thay cho dấu phẩy cũng được.

---

## 3. Pasted from Word, with numbering

Numbering at the start of a line is dropped, whatever punctuation follows it (`1.`, `2)`, `3 -`, `4:`).

```
1. Nguyễn Hà Vy
2) Trần Quốc Cường
3 - Lê Thanh Trúc
4: Phạm Minh Quân
5.  Hoàng Diệu Linh
```

**Kết quả mong đợi:** 5 bạn, không bạn nào tên bắt đầu bằng số.

---

## 4. Pasted from Excel, with a header row and a tổ column

Tab, comma, semicolon or `|` all separate columns. The header row (STT / Họ và tên / Tổ) is skipped.

```
STT	Họ và tên	Tổ
1	Nguyễn Hà Vy	1
2	Trần Quốc Cường	1
3	Lê Thanh Trúc	2
4	Phạm Minh Quân	2
5	Hoàng Diệu Linh	3
```

The same thing with semicolons, for a paste that lost its tabs:

```
STT; Họ và tên; Tổ
1; Vũ Đăng Khoa; 3
2; Đỗ Ngọc Hân; 4
3; Bùi Tiến Dũng; 4
```

**Kết quả mong đợi:** dòng tiêu đề không thành học sinh; 5 bạn (và 3 bạn) với đúng tổ.

---

## 5. A messy paste from Zalo

Title lines above the list, capitals, lower case, extra spaces, a trailing "Tổ n", and one line that is not a name.

```
TRƯỜNG TIỂU HỌC HOA MAI
DANH SÁCH HỌC SINH LỚP 4A
Năm học 2026 - 2027
Giáo viên chủ nhiệm: Cô Hạnh

NGUYỄN HÀ VY - Tổ 1
trần quốc cường - tổ 1
Lê   Thanh   Trúc — Tổ 2
Phạm Minh Quân 2
Hoàng Diệu Linh
12345
```

**Kết quả mong đợi:**

- Bốn dòng đầu (trường, danh sách, năm học, giáo viên chủ nhiệm) bị bỏ qua.
- `NGUYỄN HÀ VY` → `Nguyễn Hà Vy`, `trần quốc cường` → `Trần Quốc Cường` (tên viết HOA hay viết thường đều sửa lại).
- Khoảng trắng thừa được gom lại: `Lê Thanh Trúc`.
- Tổ đọc được từ cả `- Tổ 1`, `- tổ 1`, `— Tổ 2` (gạch dài Word tự đổi) và số đứng cuối (`Phạm Minh Quân 2` → tổ 2).
- `Hoàng Diệu Linh` không có tổ.
- `12345` báo lỗi **"Dòng này không có tên học sinh."** và không tạo tài khoản.

---

## 6. Names that fight over the same username

Seven children whose given name is "An", three of them with exactly the same full name, to see every fallback.

```
Nguyễn Văn An
Trần Thị An
Lê Hoàng An
Phạm Bảo An
Vũ An
Nguyễn Văn An
Nguyễn Văn An
```

**Kết quả mong đợi** (đã chạy thử):

| Tên | Tên đăng nhập |
| --- | --- |
| Nguyễn Văn An | `An2026` |
| Trần Thị An | `AnTT2026` |
| Lê Hoàng An | `AnLH2026` |
| Phạm Bảo An | `AnPB2026` |
| Vũ An | `AnV2026` |
| Nguyễn Văn An (bạn thứ hai) | `AnNV2026` |
| Nguyễn Văn An (bạn thứ ba) | `An2026-2` |

Tên gọi trước, rồi thêm chữ cái đầu của họ và tên đệm, hết cách mới thêm số. Không bạn nào trùng tên đăng nhập với
bạn nào — kể cả với một lớp khác đã có `An2026`. Xem trước danh sách rồi sửa tên đăng nhập nếu cô muốn.

---

## 7. Edge cases worth a look

```
Nguyễn Hoàng Bảo Ngọc Anh Thư
Đặng Thị Kiều Diễm Hương Giang
Tí
Nguyễn Thị Đông Đào
Lê Ưng Hoàng Phúc
Trần Thị Bưởi
```

**Kết quả mong đợi:**

- Tên dài không làm vỡ giao diện (sticker, Top 10, bảng điểm danh) — kiểm tra ở màn hình rộng 360px.
- `Tí` (một chữ) vẫn tạo được tài khoản.
- `Đ`, `Ư`, `Ơ` trong tên đăng nhập được bỏ dấu đúng: `Nguyễn Thị Đông Đào` → `Dao2026`, `Trần Thị Bưởi` →
  `Buoi2026`, `Tí` → `Ti2026`. Đăng nhập không phân biệt dấu, hoa thường hay khoảng trắng: gõ `dao2026`, `Đào 2026`
  hay `DAO2026` đều vào được.

---

## 8. Lists that should be refused

```

```

**Kết quả mong đợi:** ô trống → nút tạo tài khoản không bấm được.

```
Tổ 1
Tổ 2
STT
Họ và tên
```

**Kết quả mong đợi:** không tạo bạn nào. `STT` và `Họ và tên` là dòng tiêu đề nên bị bỏ qua lặng lẽ; `Tổ 1` và `Tổ 2`
báo lỗi **"Dòng này không có tên học sinh."** để cô biết hai dòng đó chưa dùng được.

Dán 61 dòng tên vào một lớp trống → báo **"Một lớp có tối đa 60 học sinh. Lớp đang có 0."**
