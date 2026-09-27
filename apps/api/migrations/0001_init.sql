-- Lớp Học Hạnh Phúc. Timestamps are UTC ISO strings; the app cuts periods on Vietnam (UTC+7) midnights.
--
-- One file, because nothing has run in a real classroom yet: this is the schema as designed, not as it grew.
-- From the first class onwards, migrations are additive and numbered from 0002.

-- Accounts --------------------------------------------------------------------
CREATE TABLE teachers (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name    TEXT NOT NULL,
  -- PBKDF2-SHA256. Hers opens the whole class, so hers is hashed.
  password_hash   TEXT NOT NULL,
  failed_logins   INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  last_login_at   TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE classes (
  id               INTEGER PRIMARY KEY,
  teacher_id       INTEGER NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  grade            INTEGER NOT NULL DEFAULT 4,
  school_year      TEXT NOT NULL,
  motto            TEXT NOT NULL DEFAULT '',
  group_count      INTEGER NOT NULL DEFAULT 4,
  show_leaderboard INTEGER NOT NULL DEFAULT 1,
  hk1_start        TEXT NOT NULL,
  hk1_end          TEXT NOT NULL,
  hk2_start        TEXT NOT NULL,
  hk2_end          TEXT NOT NULL,
  teams            TEXT NOT NULL DEFAULT '[]',
  seating          TEXT NOT NULL DEFAULT '{}',
  cover_shade      REAL NOT NULL DEFAULT 0.35,
  -- 0 = no cover photo. Bumped on every upload so image URLs change and caches refresh.
  cover_version    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX classes_teacher_idx ON classes (teacher_id);

-- A child's account belongs to the teacher, the way the paper register does. She hands out the username and the
-- password and a parent who loses them asks her, so the password is stored as she would read it out, not hashed.
-- What that costs: whoever reads this table reads every child's password. What it buys: no family is ever locked
-- out of a class app, and nothing here is worth stealing — one class's drops, tasks and the teacher's remarks.
CREATE TABLE students (
  id                   INTEGER PRIMARY KEY,
  class_id             INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  full_name            TEXT NOT NULL,
  -- "an.k7m4": the given name, a dot, and four characters a child can't misread.
  -- username_key is what sign-in matches: no case, spaces, dots or marks.
  username             TEXT NOT NULL,
  username_key         TEXT NOT NULL UNIQUE,
  password             TEXT NOT NULL DEFAULT '',
  -- 1 once the child or a parent has chosen their own, so the teacher's list can say whose is which.
  password_chosen      INTEGER NOT NULL DEFAULT 0,
  -- Every child is in a tổ: it is what the class competes in and what the register is sorted by.
  group_no             INTEGER NOT NULL DEFAULT 1,
  avatar_emoji         TEXT NOT NULL DEFAULT '🐰',
  avatar_version       INTEGER NOT NULL DEFAULT 0,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  -- Hồ sơ Măng non: what the class knows about each child.
  birthday             TEXT,
  gender               TEXT,
  hobby                TEXT NOT NULL DEFAULT '',
  dream                TEXT NOT NULL DEFAULT '',
  duty                 TEXT NOT NULL DEFAULT '', -- chức vụ: lớp trưởng, tổ trưởng…
  failed_logins        INTEGER NOT NULL DEFAULT 0,
  locked_until         TEXT,
  last_login_at        TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX students_class_idx ON students (class_id, sort_order);

-- Photos live apart from the rows they belong to, so listing students never reads image bytes.
CREATE TABLE images (
  owner        TEXT NOT NULL CHECK (owner IN ('student', 'class')),
  owner_id     INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  data         TEXT NOT NULL, -- base64
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (owner, owner_id)
);

-- Only a SHA-256 of the cookie token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  user_id    INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX sessions_user_idx ON sessions (role, user_id);

-- Drops ---------------------------------------------------------------------------
-- A plus point is một giọt nước, and the drops grow each child's plant.
CREATE TABLE point_reasons (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  category   TEXT NOT NULL CHECK (category IN ('hoc_tap', 'ren_luyen', 'yeu_thuong', 'chung')),
  kind       TEXT NOT NULL CHECK (kind IN ('plus', 'minus')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX point_reasons_class_idx ON point_reasons (class_id, sort_order);

CREATE TABLE point_events (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  category   TEXT NOT NULL CHECK (category IN ('hoc_tap', 'ren_luyen', 'yeu_thuong', 'chung')),
  -- A copy of the reason's label, so renaming or deleting a reason never rewrites history.
  reason     TEXT NOT NULL,
  emoji      TEXT,
  source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'task', 'badge')),
  task_id    INTEGER,
  batch_id   TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX point_events_class_time_idx ON point_events (class_id, created_at);
CREATE INDEX point_events_student_time_idx ON point_events (student_id, created_at);

-- A task's completion drops are given once per child, whatever arrives at the same time.
CREATE UNIQUE INDEX point_events_task_completion ON point_events (task_id, student_id) WHERE batch_id = 'task-completion';

-- Coming to school is worth a drop, and never more than one a day however often the register is taken.
CREATE UNIQUE INDEX point_events_attendance ON point_events (student_id, batch_id)
  WHERE substr(batch_id, 1, 11) = 'chuyen-can:';

-- Tasks -----------------------------------------------------------------------------
CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  class_id      INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  subject       TEXT NOT NULL CHECK (subject IN ('toan', 'tieng_viet', 'khac')),
  kind          TEXT NOT NULL CHECK (kind IN ('quiz', 'open')),
  title         TEXT NOT NULL,
  instructions  TEXT NOT NULL DEFAULT '',
  questions     TEXT NOT NULL DEFAULT '[]', -- JSON, answers included: never sent to students as is
  reward_points INTEGER NOT NULL DEFAULT 0,
  allow_retry   INTEGER NOT NULL DEFAULT 1,
  due_date      TEXT, -- local date; due at the end of that day
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed')),
  published_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX tasks_class_idx ON tasks (class_id, status, created_at);

CREATE TABLE submissions (
  id                 INTEGER PRIMARY KEY,
  task_id            INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  student_id         INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  answers            TEXT, -- JSON
  text_answer        TEXT,
  correct            INTEGER,
  total              INTEGER,
  score              REAL,
  attempts           INTEGER NOT NULL DEFAULT 1,
  status             TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),
  evaluation         TEXT CHECK (evaluation IN ('T', 'H', 'C')),
  teacher_comment    TEXT,
  reviewed_at        TEXT,
  first_submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  submitted_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (task_id, student_id)
);
CREATE INDEX submissions_student_idx ON submissions (student_id, submitted_at);

-- Rewards and badges -------------------------------------------------------------------
CREATE TABLE rewards (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  cost       INTEGER NOT NULL CHECK (cost > 0),
  active     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A pending request already holds its drops, so a child can't ask for more than they have.
CREATE TABLE redemptions (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  reward_id    INTEGER,
  reward_name  TEXT NOT NULL,
  emoji        TEXT NOT NULL,
  cost         INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_at   TEXT
);
CREATE INDEX redemptions_class_idx ON redemptions (class_id, status, requested_at);
CREATE INDEX redemptions_student_idx ON redemptions (student_id, status);

CREATE TABLE student_badges (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  badge_key  TEXT NOT NULL,
  source     TEXT NOT NULL CHECK (source IN ('auto', 'teacher')),
  note       TEXT,
  awarded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (student_id, badge_key)
);
CREATE INDEX student_badges_class_idx ON student_badges (class_id, awarded_at);

-- Teacher ↔ family -----------------------------------------------------------------------
-- Nhận xét: the teacher's written comments on a child, shown to the family.
CREATE TABLE notes (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX notes_student_idx ON notes (student_id, created_at);

-- One thread per child, between the teacher and the family signed in on the child's account.
CREATE TABLE messages (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('teacher', 'family')),
  body       TEXT NOT NULL,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX messages_thread_idx ON messages (student_id, created_at);
CREATE INDEX messages_class_idx ON messages (class_id, created_at);

CREATE TABLE announcements (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  pinned     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX announcements_class_idx ON announcements (class_id, pinned, created_at);

-- Bảng tin: one theme a month, and tiles under it like the cards on a Padlet wall -----------------
CREATE TABLE board_months (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  month      TEXT NOT NULL, -- 'YYYY-MM' on the Vietnam calendar
  theme      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  emoji      TEXT NOT NULL DEFAULT '🌼',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (class_id, month)
);

CREATE TABLE posts (
  id          INTEGER PRIMARY KEY,
  class_id    INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('hoat_dong', 'viec_nha', 'loi_nhan')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT 'vang',
  pinned      INTEGER NOT NULL DEFAULT 0,
  due_date    TEXT, -- 'việc ở nhà' tiles: the local date the work is for
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX posts_class_idx ON posts (class_id, month, pinned, created_at);

-- Photos of the children, apart from the tile itself so reading the board never reads image bytes.
CREATE TABLE post_photos (
  id           INTEGER PRIMARY KEY,
  post_id      INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  class_id     INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL,
  data         TEXT NOT NULL, -- base64
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX post_photos_post_idx ON post_photos (post_id, position);

-- A family likes from their child's account, so one heart per child.
CREATE TABLE post_likes (
  post_id    INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (post_id, student_id)
);

CREATE TABLE post_comments (
  id         INTEGER PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  author     TEXT NOT NULL CHECK (author IN ('teacher', 'family')),
  -- Which child's account wrote it. NULL when the teacher did.
  student_id INTEGER REFERENCES students (id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX post_comments_post_idx ON post_comments (post_id, created_at);

-- Chuyên cần -------------------------------------------------------------------------------------
CREATE TABLE attendance (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  day        TEXT NOT NULL, -- local date
  status     TEXT NOT NULL CHECK (status IN ('co_mat', 'di_muon', 'co_phep', 'khong_phep')),
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (class_id, student_id, day)
);
CREATE INDEX attendance_day_idx ON attendance (class_id, day);
CREATE INDEX attendance_student_idx ON attendance (student_id, day);

-- Vinh danh ----------------------------------------------------------------------------------------
CREATE TABLE honours (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  period       TEXT NOT NULL CHECK (period IN ('week', 'month', 'semester', 'year')),
  -- The first local date of the period it honours, so the same week can only be crowned once.
  period_key   TEXT NOT NULL,
  period_label TEXT NOT NULL,
  title        TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  -- The drops that earned it, kept as they stood on the day.
  points       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (class_id, period, period_key, student_id)
);
CREATE INDEX honours_class_idx ON honours (class_id, created_at);
CREATE INDEX honours_student_idx ON honours (student_id, created_at);
