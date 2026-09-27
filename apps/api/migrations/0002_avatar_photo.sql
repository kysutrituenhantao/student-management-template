-- "Ảnh đại diện của HS k thể thay đổi" (brief 3, 24/09/2026).
--
-- A photo is served from /api/media/student/<id>?v=<avatar_version>, marked `immutable` for a year: the version in
-- the URL is the only thing that tells a browser the picture changed. Removing a photo used to set the version back
-- to 0, so the next upload was v=1 again — the same URL as the first photo, and the browser kept showing it.
--
-- From here the version only ever goes up, and this column says whether there is a photo at all. Existing photos
-- are found in `images`; every version is pushed past the range already handed out, so no cached URL comes back.
ALTER TABLE students ADD COLUMN has_photo INTEGER NOT NULL DEFAULT 0;

UPDATE students SET has_photo = 1 WHERE id IN (SELECT owner_id FROM images WHERE owner = 'student');
UPDATE students SET avatar_version = avatar_version + 1000;
