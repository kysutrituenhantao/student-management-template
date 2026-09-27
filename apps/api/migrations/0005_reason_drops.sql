-- Brief 7 (24/09/2026): "tiêu chí cộng điểm và trừ điểm… hiển thị tiêu chí và điểm giọt nước. Ví dụ: Chăm chỉ cộng 2
-- giọt nước; Không làm BT trừ 2 giọt nước."
--
-- A criterion now carries how many drops it is worth; always positive, the sign is its `kind`. Every criterion made
-- before today is worth 1 — the smallest number that works — until she sets her own. Code that predates this column
-- never reads it.
ALTER TABLE point_reasons ADD COLUMN drops INTEGER NOT NULL DEFAULT 1;
