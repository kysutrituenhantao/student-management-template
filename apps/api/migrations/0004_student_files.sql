-- Brief 5 (24/09/2026, late evening): "Ở phần hồ sơ măng non, thêm tên học sinh cho thêm mục tải tệp lên
-- (doc,docx,xlsx…) để đầy đủ thông tin."
--
-- The forms and records that complete a child's page. They are the teacher's own: a filled-in form can hold the
-- parents' phone numbers, so neither the child's account nor a classmate is ever served one.
--
-- A D1 value holds at most 2 MB, and a Word form with a photo pasted in is often bigger, so the bytes are kept as
-- base64 in numbered parts of at most 1.5 MB each, written in the same batch as the file. Nothing here touches an existing table.
CREATE TABLE student_files (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX student_files_student_idx ON student_files (student_id, created_at);

CREATE TABLE student_file_parts (
  file_id INTEGER NOT NULL REFERENCES student_files (id) ON DELETE CASCADE,
  seq     INTEGER NOT NULL,
  data    TEXT NOT NULL, -- base64
  PRIMARY KEY (file_id, seq)
) WITHOUT ROWID; -- so writing a part leaves last_insert_rowid() on the file the parts belong to
