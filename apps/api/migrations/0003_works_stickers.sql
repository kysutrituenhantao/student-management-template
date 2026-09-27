-- Brief 4 (24/09/2026, evening): "Sản phẩm của em" and the stickers on the board.

-- "Thêm mục SẢN PHẨM CỦA EM ở phần hồ sơ măng non (mỗi HS có 1 mục này)… GV có thể tải bài kiểm tra, sản phẩm HS
-- làm để PH theo dõi (PH k tải đc tài liệu do gv upload mà chỉ xem)".
--
-- A marked test is about one child, so unlike an avatar or a photo on the board it is served to that child's own
-- account and to the class's teacher, and to nobody else — not even a classmate. The teacher uploads it; the family
-- looks at it. The image is base64 in the row, like every other picture here, so no paid storage is needed.
CREATE TABLE student_works (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL,
  data         TEXT NOT NULL, -- base64
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX student_works_student_idx ON student_works (student_id, created_at);

-- "Phần Bảng tin: giao diện các bảng tin đa dạng hơn, có các sticker trong mỗi ô padlet."
-- One sticker a tile, chosen from a fixed set ('' is a tile without one), and the shape the tile is cut in.
-- Every tile written before today keeps the pinned-paper look it already had.
ALTER TABLE posts ADD COLUMN sticker TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN layout TEXT NOT NULL DEFAULT 'ghim';
