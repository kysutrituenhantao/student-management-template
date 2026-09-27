-- Brief 12 (25/09/2026): Vinh danh becomes Thi đua.
--
-- "Kết quả thi đua của các lớp trong trường, xếp loại điểm từ cao đến thấp theo biểu đồ hình cột (riêng lớp 4C luôn là
-- cột màu đỏ)". The school's results for a week or a month, as she types them: each class's name and score, one row
-- marked as her own class. Kept per class of hers, so a teacher with two classes keeps two lists.
CREATE TABLE competition_results (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  period       TEXT NOT NULL CHECK (period IN ('week', 'month')),
  period_key   TEXT NOT NULL, -- the period's first local date
  period_label TEXT NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (class_id, period, period_key)
);

CREATE TABLE competition_rows (
  result_id INTEGER NOT NULL REFERENCES competition_results (id) ON DELETE CASCADE,
  seq       INTEGER NOT NULL,
  name      TEXT NOT NULL,
  score     REAL NOT NULL,
  is_ours   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (result_id, seq)
) WITHOUT ROWID;

-- "Icon huy hiệu và nội dung Huy hiệu GV có thể chỉnh sửa". Her words for a badge, per class; a badge without a row
-- here shows the app's own. The badge itself (its key, and the milestone of an automatic one) never changes.
CREATE TABLE badge_labels (
  class_id    INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  badge_key   TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (class_id, badge_key)
) WITHOUT ROWID;
