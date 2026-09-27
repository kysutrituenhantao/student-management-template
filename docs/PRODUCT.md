# Product: requirements, sources and decisions

**This copy was started from a template.** Everything down to "Requirements from this class" at the end comes from
the teacher the app was first built for, and is kept as the record of why each feature exists. The teacher who owns
this copy adds her own rows at the end, and a row of hers replaces any earlier row it contradicts.

The first product owner was a grade-4 homeroom teacher (giáo viên chủ nhiệm lớp 4). She wants an app to run her
class that, unlike the one she saw, **lets parents see their child's results and learning activities** ("App của họ
tạo chưa có tương tác vs PH mà c muốn PH có thể xem đc kết quả và hoạt động học của con"). This file traces every
requirement to where it lives in the app, so she can check it, and records the calls made where she didn't say.

## Sources

1. **Her written brief** (Zalo, 2026-09-22). She asked ChatGPT to write "5 prompts" for Google AI Studio for a Vite +
   React app called "Lớp học hạnh phúc", then sent the brief to her brother, who built it, instead.
2. **The reference video** she forwarded: a TikTok tutorial in which another teacher (cô Lan Phương) builds "Lớp học cô
   Phương – Tràn ngập yêu thương" with a ChatGPT prompt pasted into Google AI Studio. The visible part of that prompt and
   its follow-up are transcribed in `docs/reference/video-prompt.md`. Her app is frontend only and offline: no accounts,
   no parents, data only in one browser.
3. **Her second brief** (Zalo, 2026-09-23), after she saw the app running: eight features, listed in their own table
   below. She also settled the name — "4.0" was never a version, it is the grade she teaches — and asked for the board
   to look "như padlet, từng ô ô rứa".
4. **Her third brief** (a Word file, "Vấn đề cần điều chỉnh", 2026-09-24), after she had taught with it for a day:
   nine adjustments and two screenshots — the first list that comes from use rather than from looking. Its own table
   below.
5. **Her brother's direction**: rebuild it properly with a backend that stores teachers, students and parents' interaction,
   secure, free to run, a `.online` domain (about 20,000 VND a year).

## Her brief, point by point

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 1 | Create classes (tạo lớp học) | Teacher home → "Tạo lớp mới". Several classes per teacher; class switcher in the top bar | Done |
| 2 | Add many students at once, one per line, like Beeclass | Học sinh → "Thêm học sinh": paste from Word, Excel or Zalo. Numbering, header rows and ALL-CAPS names are cleaned up; an optional group number after a comma. Live preview with the usernames before creating | Done |
| 3 | Accounts created automatically: username = given name + 2026 ("Nguyễn Văn An" → "An 2026") | The given name is there, the year is not: `an.k7m4`. Four random characters replaced the year in September 2026, when her brother asked for accounts that can't collide or be guessed. Sign-in ignores case, spaces, dots and Vietnamese marks, so "an.k7m4", "AN K7M4" and "ank7m4" all work | Changed with her brother |
| 4 | Default password `abcd1234` | Replaced, at her brother's request, by a generated 6-character password a child can't misread. The teacher reads it back whenever a parent asks (see "Decisions") | Changed with her brother |
| 5 | No sign-up, no email: just username and password | `/dang-nhap/` has two fields. No email anywhere | Done |
| 6 | Change password after signing in | Forced at the first sign-in: nothing else opens until it's changed. Also from "Tài khoản" | Done |
| 7 | Teacher resets a forgotten password to the default | Học sinh → key icon. Also unlocks the account and signs out other devices | Done |
| 8 | Students can upload their own avatar | Family side → Tài khoản → "Tải ảnh của con", or pick an animal sticker. The teacher can set it too | Done |
| 9 | Tasks by subject: Toán, Tiếng Việt | Nhiệm vụ → "Giao nhiệm vụ mới": Toán, Tiếng Việt (and "Môn khác"), what to do, and the day it is for. It was a workbook the app marked until she asked for a noticeboard instead — row 38 | Changed by her |
| 10 | Track results (theo dõi kết quả) | Báo cáo and Kết quả: drops by day, week and term, by reason and by tổ, per child and for the class, plus the register and the honour roll. Marked homework is no longer among them — row 38 | Changed by her |
| 11 | Record conduct and rewards (ghi nhận rèn luyện, khen thưởng) | Drops with reasons in three groups (Học tập, Rèn luyện, Yêu thương), badges, reward shop | Done |
| 12 | Weekly, monthly and semester reports as charts | Báo cáo: week / month / semester / year, drops per day, week or month, by group, top reasons, how many tasks she set in each subject, a table per child, CSV for Excel, print. The same report per child for the family | Done |
| 13 | Student / parent area: sign in with the given account | One account per child, used by the child and the parents | Done |
| 14 | See and do tasks | Family side → Nhiệm vụ: what the teacher set, in her words, with the subject and the day it is for. The work itself is done in the exercise book — row 38 | Changed by her |
| 15 | See results, progress and rewards | Kết quả (charts, the register, honours, the teacher's remarks), the plant on the home screen, and Huy hiệu. Rewards are handed over in class — row 40 | Done |
| 16 | Parents can see results and learning activity | The same account shows drops with reasons, the class board, what the teacher has set, her remarks (nhận xét, lời phê), class notices, and a message thread with her | Done |
| 17 | Works on phones, tablets and computers | Phone-first family side with a bottom bar; wide teacher screens; e2e checks no sideways scroll on phone and laptop | Done |
| 18 | Fast, bright and simple for children | Static pages from Cloudflare's edge; pastel colours; large tap targets | Done |
| 19 | Name: "Lớp học hạnh phúc" | Everywhere. Not "4.0": she teaches grade 4, it was never a version number | Done |

## From the reference video

| Feature in cô Lan Phương's app | Here |
| --- | --- |
| 3D chibi, cute; pastel pink, pastel blue, light yellow, white; stars, hearts, clouds, books | Same palette. The page is a Vietnamese "vở ô li" exercise book; every child is a die-cut sticker with an animal; the teacher's remarks are in red pen |
| Cover photo of the whole class, with class name, slogan, teacher, student count, adjustable shade | Trang chủ → "Tải ảnh cả lớp"; the shade is in Cài đặt. A green board until a photo is uploaded |
| +⭐ / −⭐ right on each student's sticker; a quick menu (+1 +2 +3 +5 +10) on press-and-hold | Done, with her water drops in place of stars. Tap the drop count or hold +💧 for the menu |
| No reason required; add one later from "Lịch sử" or "Thêm lý do" | Done: after each tap an undo bar offers "Thêm lý do" and "Hoàn tác"; "Lịch sử" lists every award |
| Preset reasons (Phát biểu, Chăm chỉ, Việc tốt, Giúp bạn, Tự tin, Sáng tạo, Tiến bộ, Thành tích) and custom ones | Same list plus a few, editable in Cài đặt |
| +1 animation around the avatar, bigger for +5 | Drops float up with sparkles; bigger from +5 |
| Level-up popup "🎉 CHÚC MỪNG! … ĐÃ LÊN LEVEL 5!" with confetti and "❤️ TUYỆT VỜI!" | Done, as "Cây của … vừa lớn lên!" |
| Top 10 of the week | On the teacher's home and (if she allows it) the family's home |
| Filter by tổ, search, sort | Done |
| Teams (tổ) with names, mascots, leader, deputy, totals and average per child | Tổ & Sơ đồ lớp |
| Seating chart with rows and desks, arrange by team | Tổ & Sơ đồ lớp, with "Xếp theo tổ" and "Xếp ngẫu nhiên" |
| Reward shop (Đổi quà) | Hers alone since 24 September: she picks the child and the reward and hands it over. Families do not shop — row 40 |
| Badges (Huy hiệu) | 8 awarded automatically (drops and kindness), 11 the teacher gives |
| Games: lucky wheel, random call, duck race, group split | All four, plus the archery she asked for, in "Gọi ngẫu nhiên" on Trang chủ, each able to give the drop — rows 39 and 47. "Chia nhóm" is beside it |
| "Góc yêu thương" (love corner), "Yêu thương" count | Kindness reasons count as "Yêu thương"; shown on the home stats and in reports |
| Offline mode, backup and restore, PWA | Her app had to be offline because it stored nothing on a server. Here the data lives in Cloudflare D1 (7 days of Time Travel, plus exports; see DEPLOY.md), so a lost phone loses nothing. The app can be added to a phone's home screen (web manifest); it needs a connection |
| Flip cards (lật thẻ), boys/girls alternating seats | Not built. Her second brief added gender to each child's profile, so alternating seats is now possible — she has not asked for it |


## Her second brief (23 September 2026)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 20 | **Bảng tin lớp học** with a theme she sets each month | Bảng tin → "Chủ đề tháng". The month's chủ điểm is suggested from the Vietnamese school calendar (September "Mái trường mến yêu", November "Biết ơn thầy cô"…) and she can write her own | Done |
| 21 | Posts of the class's activities that parents sign in to read | Bảng tin → "Thêm ô tin": a title, a few lines, up to 6 photos, a colour, and a pin to keep it on top. Three kinds: hoạt động, việc ở nhà, lời nhắn | Done |
| 22 | Parents can like and comment | A heart (one per family) and a comment thread under each note. She can answer, and take down anything unkind | Done |
| 23 | Daily tasks / work at home on the board | The "Việc ở nhà" note carries the date it is for. (Marked homework stays in Nhiệm vụ, which the app grades) | Done |
| 24 | The board should look like Padlet, "từng ô ô rứa" | A wall of coloured paper notes in masonry columns, 1 on a phone, up to 4 on her laptop | Done |
| 25 | **Hồ sơ Măng non**: name, date of birth, hobby, dream, gender, chức vụ, tổ | Hồ sơ Măng non, one card a child | Done |
| 26 | She fills it in, and children can edit their own when signed in | She edits any card; a child edits their own from "Sửa trang của con" — except the chức vụ, which is hers to give | Done |
| 27 | **Vườn hoa điểm tốt**: one plus point = one drop of water | 💧 everywhere a point is shown, on both sides of the app | Done |
| 28 | The plant grows: 10 drops it sprouts, 50 two seed leaves, 100 small leaves, 200 taller with more | Her four steps, and the ones above them rewritten by her on 24/09 — see row 54 | Done |
| 29 | She creates and edits the plus and minus criteria | Cài đặt → "Lý do cộng, trừ điểm" (was already there) | Done |
| 30 | Score a tổ, a group of children or the whole class at once | Trang chủ → "Chọn nhiều bạn" → a tổ, the whole class, or any few children (was already there) | Done |
| 31 | Charts of training by week, month and semester that parents can see | Báo cáo for her, Kết quả for the family; both now also do the whole school year | Done |
| 32 | **Đổi thưởng** priced in drops, deducted when redeemed | Đổi quà (was already there), priced in 💧 | Done |
| 33 | **Thi đua theo tổ** by week, month and year | Tổ & Sơ đồ lớp → "Bảng thi đua các tổ": week, month, semester, year, with points per member so a big tổ doesn't win on size | Done |
| 34 | **Gọi tên ngẫu nhiên**: wheel, duck race, **archery** | Vòng quay, Đua vịt, **Bắn tên** (new), Gọi nhanh — and Chia nhóm beside them. On Trang chủ since row 39; see row 47 for how they move | Done |
| 35 | **Theo dõi chuyên cần**; marking a child present gives +1 automatically | Chuyên cần: one tap a child saves at once, or "Cả lớp có mặt". Có mặt and đi muộn each earn the day's drop; nghỉ does not, and taking a drop back if she corrects herself | Done |
| 36 | **Vinh danh**: star of the week, month, semester, year | Vinh danh: the period's ranking, crowning from it, and a wall of certificates to project. The family sees it under Kết quả | Done |

## Her third brief (24 September 2026)

"Vấn đề cần điều chỉnh", written after a day of teaching with it.

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 37 | "Ảnh đại diện của HS k thể thay đổi" | A photo is served from a URL carrying `avatar_version` and cached for a year. Removing a photo used to set that version back to 0, so the next photo took the first one's URL and the browser kept showing the old face. The version now only ever goes up, and a separate flag says whether there is a photo (migration `0002_avatar_photo.sql`). Choosing a sticker while a photo is set now replaces it in one tap | Fixed |
| 38 | "Phần nhiệm vụ k cần HS trả bài trên web, chỉ hiển thị nội dung GV giao việc" | Nhiệm vụ is a noticeboard: môn học, tên nhiệm vụ, nội dung cô giao, hạn. The family reads it; nothing is handed back. The quiz runner, submissions, marking and "bài chờ cô chấm" are gone | Done |
| 39 | "Phần chọn ngẫu nhiên còn đơn điệu, thêm hình thức như: Vòng quay may mắn, Bắn tên, đua vịt" | "Gọi ngẫu nhiên" on Trang chủ now asks how: Gọi nhanh, Vòng quay may mắn, Bắn tên or Đua vịt — each with "+1 💧 cho …" so the drop is given where she is standing. The Trò chơi tab itself went in row 52, since everything in it is here | Done |
| 40 | "Chưa có phần đổi thưởng ở trang của GV… Ở trang PH và HS bỏ phần đổi thưởng" | Đổi thưởng is hers alone: "Trao quà" is the first thing on the tab, she picks the child and the reward, and the drops are taken. The family's "Quà" tab is now "Huy hiệu" — badges only, no shop, and no "giọt nước để đổi quà" on the home screen | Done |
| 41 | "Chú ý nước mất đi k làm cây nhỏ lại, HS sẽ phải cố gắng thêm nhiều hơn để cây tiếp tục lớn tiếp" | The growth stage counts drops **earned**; a reward costs the spendable balance. The same rule that already protected the plant from minus points, said on the screen where she hands a reward over | Done |
| 42 | "Chưa sửa đc thành viên các tổ" | "Sửa tổ" now edits the tổ's members: she taps the children she wants in it and saves once. A child already in the tổ stays there until another tổ takes them, because every child belongs to a tổ | Done |
| 43 | "Điểm danh chuyên cần tự động cộng 1 giọt nước" | It already did, but nothing said so. The register now says "Đã điểm danh và cộng 1 💧 cho N bạn" as it saves, and keeps a running "Đã tặng N giọt nước chuyên cần hôm nay" | Done |
| 44 | "Giao diện vinh danh: 3 bạn đứng đầu sẽ thể hiện như dưới đây, từ 4 đến 50 xếp theo danh sách" (with a screenshot of a podium) | Vinh danh opens on a podium — 👑 Quán quân in the middle and highest, 🥈 Á quân 1 to its left, 🥉 Á quân 2 to its right — and the rest follow as the list she knows. Crowning works from either | Done |
| 45 | "Hiển thị thi đua của học sinh theo danh sách dọc, hiển thị ngang các thông tin (hiện tại đang làm theo bản đồ ô vuông)" — with the row written out: "(ảnh đại diện) <tên> — LV2 (hình cây phát triển) – Tổ 1 – giọt nước" | Vườn hoa của lớp opens as her list: ảnh, tên, 🌱 Lv, Tổ, then −💧 / số / +💧. A "☰ Danh sách / ▦ Ô vuông" switch keeps the sticker grid, and the browser remembers which she used | Done |
| 46 | "Ở mục nhắn tin của PH, khi nhắn GV k xem đc và k tương tác lại được" | The messages worked; she could not find them. "Phụ huynh" is the 13th of 14 tabs and its unread badge sits past the edge of a laptop screen. The count is now a tile on Trang chủ, where she stands all lesson, and it opens the thread | Fixed |

## Her fourth brief (24 September 2026, evening)

`3.docx`, the same file grown and **colour-coded**: black is done, red is still to do
("phần màu đỏ e hi / màu đen là ok rồi"). She ticked off seven of the nine above in her own hand. These are the red
ones. From here the Word file is the contract: "e lấy file word làm tài liệu chính, chị note gì có nấy".

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 47 | "Phần chọn ngẫu nhiên còn đơn điệu" — reopened, with the movement written out: the wheel "quay tròn khoảng 2-3 vòng rồi dừng", the arrow "bắn vào tên, tốc độ chậm hơn", the ducks "đua cả lớp, thời gian đua khoảng 5-7s" | Three numbers, so they live in `packages/shared/src/games.ts` with their tests. The wheel turns between two and three times, alignment included, and takes 1.2s a turn. The arrow crosses in 2.4s instead of 1.15s and lands on the name. The duck race no longer asks her to pick racers: the whole class swims, one duck is home in 5–7 seconds and the rest follow, each lane on its own easing so they overtake. Past a dozen children the pond has two halves, so all 35 lanes fit a laptop | Done |
| 48 | "GV chưa có phần liên lạc vs phụ huynh… tạo thêm mục 'Liên lạc'" — and, in item 8, "Lời nhắn là mục GV liên lạc vs PH, tin nhắn của PH sẽ hiện trong này" | The messaging always worked; it was called "Phụ huynh" and sat 13th of 14 tabs. It is now **Lời nhắn**, the last button of the second row, with the unread count on it, and it says what it is for. She can open a thread with any family, not only ones that wrote first | Done |
| 49 | "Thêm mục SẢN PHẨM CỦA EM ở phần hồ sơ măng non (mỗi HS có 1 mục này)… sẽ hiển thị ở giao diện của PH trong mục kết quả… GV có thể tải bài kiểm tra, sản phẩm HS làm để PH theo dõi (PH k tải đc tài liệu do gv upload mà chỉ xem)" | A section on each child's Măng non page: she adds a photo with a label if she wants one, and it is saved as soon as it is added. The family finds it first under **Kết quả**, under the same name. Nothing there offers a copy — no download link, the image is served `content-disposition: inline`, dragging is off and the right-click menu is suppressed. A screenshot is still a screenshot; this stops a marked test being passed on by accident, not a determined person. Migration `0003_works_stickers.sql` | Done |
| 50 | "Phần Bảng tin: giao diện các bảng tin đa dạng hơn, có các sticker trong mỗi ô padlet" | A tile now has a **sticker** (30 to choose from, stuck on its corner) and one of four **shapes**: giấy ghim, nhãn dán (cut corners, a slight tilt), khung ảnh (a thick frame) and bảng con (the green board at the front of the class, chalk writing). Six paper colours as before | Done |
| 51 | "Trên thanh công cụ (mục Học sinh chuyển vào hồ sơ măng non, tạo 2 tab nhỏ trong mục gồm: Hồ sơ măng non – Tài khoản học sinh)" | Học sinh is no longer a tab. Hồ sơ Măng non opens a second little row: **Hồ sơ Măng non** and **Tài khoản học sinh** | Done |
| 52 | "Thanh công cụ chia làm 2 hàng: Trang chủ - Bảng tin – Nhiệm vụ - Hồ sơ măng non – Chuyên cần / Sơ đồ lớp – Báo cáo – Vinh danh – Đổi thưởng – Lời nhắn" | Exactly those ten, five and five — **superseded by row 55**, one row; Vinh danh renamed **Thi đua** in row 64. Huy hiệu joins Vinh danh as a second little tab, Cài đặt moves into the menu by her name, and Trò chơi goes: every game is on Trang chủ under "Gọi ngẫu nhiên" and "Chia nhóm". Her old links still work | Done |
| 53 | "(Mong muốn icon cây to hơn, rõ hơn)", in red beside her screenshot of the class | The plant is **drawn**, not an emoji: eight pictures that change shape — the seed splits, the sprout opens two seed leaves, leaves climb the stem in pairs, the stem thickens into a trunk with a crown, the crown buds, the buds open. 40px in her class list, 104px on the child's own page, 132px when a plant grows a stage | Done |

## Her ladder, rewritten (24 September 2026, in reply)

Asked whether to add fruit, she rewrote the whole ladder instead, and gave the reason in one line:

> "800 giọt hs è khóc ngất vì kb bao giờ cây ra hoa. Haha"

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 54 | "hạt giống → nảy mầm (10 giọt) → hai lá mầm (50) → lá con (100) → cây con (150) → cây xanh tốt (200) → cây ra nụ (250) → cây nở hoa (300) - cây có quả (400)" … "500 quả chín. Sau 500 cây tự thêm level mỗi lần thêm 100 giọt (vẫn hiện quả đỏ k thay đổi giao diện chỉ thay đổi lv)" | Ten drawn stages on her numbers: the blossom comes at **300** instead of 800, green fruit at 400, ripe at 500. Past ripe the levels **never stop**: one every 100 drops, same tree, same red fruit, only the number climbs, so the bar is never full and a child who is far ahead still has something to earn in June. `ENDLESS_STEP` in `progress.ts`; `levelInfo(n)` names a level beyond the drawn ones. The two badges that marked 350 and 550 — numbers that no longer exist — now mark the blossom (300) and the ripe fruit (500), keeping their keys so a child who holds one keeps it | Done |

## Her fifth brief (24 September 2026, late evening, in chat)

She sent a screenshot of the toolbar with the empty right half of both rows circled in red.

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 55 | "Trống nhiều quá. Hãy dồn thanh công cụ lên 1 hàng. Lưu ý không để thông tin ra khỏi màn hình. Tôi không muốn thu nhỏ trang để thấy toàn bộ thanh công cụ" | The same ten buttons in row 52's order, **on one row** wherever a laptop is wide enough (1280px and up). Narrower than that — a small tablet, a phone — they become a grid of small tiles, picture over name, five or ten across, so every button is still on the screen at once. Nothing scrolls sideways and nothing needs zooming out | Done |
| 56 | "Ở phần hồ sơ măng non, thêm tên học sinh cho thêm mục tải tệp lên (doc,docx,xlsx…) để đầy đủ thông tin. Cũng mục đó có phần tải xuống tệp mẫu chưa có thông tin để GV điền thông tin" | **📎 Tệp hồ sơ** on each child's Măng non page, under the child's name: she uploads Word, Excel, PDF or a photo (up to 5 MB, 10 files a child) and downloads it again with its own name. The same section has **Tải phiếu mẫu (để trống)**: a blank "Phiếu thông tin học sinh" (`apps/web/public/mau/`, made by `scripts/make-profile-template.mjs`) with the Măng non fields and the family's details. Only the teacher sees these files — they can hold parents' phone numbers. Migration `0004_student_files.sql` | **Removed** (row 60) |

## Her sixth brief (24 September 2026, late evening, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 57 | "Tạo tài khoản và mật khẩu học sinh tự động theo mẫu: tên lót-tên-ngày sinh. Ví dụ: minhanh27; hoaian22; ngocanh01. Mật khẩu: Abc12345" | A new account's username is the last two words of the name and the two-digit day of birth (`minhanh27`), with a letter after it if it is taken (`minhanh27b`); without a birthday, the name alone. Every new password, and every "Đặt lại mật khẩu", is **Abc12345**. The class list she pastes takes a date of birth after the name, which also fills the Măng non birthday. **Tạo lại tài khoản cả lớp theo mẫu** in Tài khoản học sinh moves a class made before this onto the pattern. `usernameFor` in `packages/shared/src/username.ts` | Done |
| 58 | *(not asked — see the first teacher's brief 6)* | With one password for the class and a username anyone can work out, a family that signs in with Abc12345 **chooses its own password first**; the API answers nothing else until it has. The teacher still reads the new one | Done |

## Her seventh brief (24 September 2026, late evening, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 59 | "Tôi cần mục tiêu chí cộng điểm và trừ điểm. Giáo viên có thể thay đổi, thêm bớt tiêu chí… nằm trong phần Đổi thưởng… 3 tab: Đổi thưởng; Điểm cộng; Điểm trừ… hiển thị tiêu chí và điểm giọt nước. Ví dụ: Chăm chỉ cộng 2 giọt nước; Không làm BT trừ 2 giọt nước. Phần này liên kết sang phần thêm điểm hoặc trừ điểm cho HS ở trang chủ. Vẫn giữ nguyên hiển thị ban đầu" | Đổi thưởng opens a second little row: **Đổi thưởng · Điểm cộng · Điểm trừ**. Each criterion has an emoji, a name and a number of drops, and she adds, edits and removes them there (they used to sit at the bottom of Cài đặt, without a number). On Trang chủ the scoring sheet looks as it did, but each criterion shows its drops and one tap gives exactly that. Criteria made before today start at 1 drop. Migration `0005_reason_drops.sql` | Done |

## Her eighth brief (24 September 2026, late evening, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 60 | "Bỏ mục này", on a photo of **Tệp hồ sơ** in a child's Măng non page | Gone from the page, with its blank form. The API and the `student_files` table stay, so nothing she may have uploaded is lost; they are unreachable from the app | Done |

## Her ninth brief (24 September 2026, late evening, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 61 | "Bỏ phân môn. K cần hiển thị các phân môn. Các ô nhiệm vụ được sắp xếp theo bố cục ô vuông như Padlet, tự động thay đổi màu chọn gam màu pastel nhẹ nhàng" | Nhiệm vụ has no subject filter, the editor asks no subject, and no task, report or family screen shows one (the column stays, defaulting to "khac", so old tasks are untouched). Tasks are **square tiles** in a grid, each in one of eight **pastel** papers picked from the task itself, so neighbours differ and a task keeps its colour. The family's Nhiệm vụ is the same grid | Done |

## Her tenth brief (24 September 2026, 21:33, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 62 | "Chỉnh sửa giao diện mỗi nhiệm vụ là 1 tờ giấy note có đính đinh ghim. Hình thức đẹp, dễ thương phù hợp với học sinh" | Each task on Nhiệm vụ (hers and the family's) is a **sticky note with a drawn pushpin**: pastel paper from row 61, straight corners, a small tilt that differs note to note, a folded bottom corner and a lifted shadow; the pin's colour varies too. It straightens and lifts when the mouse is over it | Done |

## Her eleventh brief (24 September 2026, 21:49, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 63 | "Dù nhiệm vụ dài hay ngắn, chỉ hiển thị như ô thứ 3, nếu dài quá thì chấm ba chấm, HS và PH có thể chọn vào nhiệm vụ để xem đầy đủ" | Every note on Nhiệm vụ is the same square; text that doesn't fit ends in "…", measured to the note so it never cuts a line in half. Tapping a note opens the whole task (title, due date, every line) on a note of the same colour — for families and for her | Done |

## Her twelfth brief (25 September 2026, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 64 | "Ở phần vinh danh đổi tên thành Thi đua: bổ sung thêm 1 tab (đặt ở đầu tiên) tên là: Kết quả thi đua… GV có thể thêm kết quả thi đua của các lớp trong trường, xếp loại điểm từ cao đến thấp theo biểu đồ hình cột (riêng lớp 4C luôn là cột màu đỏ…)" | The toolbar's eighth button is **Thi đua**; its little row is **Kết quả thi đua · Vinh danh · Huy hiệu**. Kết quả thi đua: per week or month she enters each class's name and score (the next period starts from the last list of classes); a column chart sorts them high to low, **her own class always red**, with its rank written out. Migration `0006_competition.sql` | Done |
| 65 | "Tab 3 là tab Huy hiệu (Icon huy hiệu và nội dung Huy hiệu GV có thể chỉnh sửa)" | ✏️ on each badge: its emoji, name and description are hers to change, per class, everywhere the badge shows (her screens and the family's). An automatic badge keeps its milestone | Done |
| 66 | "Phần thi đua này sẽ hiển thị ở tài khoản của PH/HS (thay phần huy hiệu) - hiển thị đủ tab 1 và tab 2. Tab 3 chỉ hiện huy hiệu của cá nhân… cho PH thấy vị trí của con mình trong tuần qua… đồng thời biết đc vị trí của lớp trong trường" | The family's **Huy hiệu** becomes **Thi đua**, three little tabs: the school chart (read-only); Vinh danh with the child's own rank in the class for the week or month, the Top 10 when she allows it (Cài đặt), and the child's honours; and Huy hiệu showing only the badges the child has earned. Old links to Huy hiệu land on it | Done |
| 67 | "Phần nhiệm vụ các trang giấy note được đặt thẳng k để nghiêng" | The notes hang straight; pin, pastel paper and folded corner stay (supersedes the tilt in row 62) | Done |

## Her thirteenth brief (25 September 2026, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 68 | "Ở phần bảng tin tôi muốn khi nhấn vào bài viết có thể xem được HS nào like hay bình luận bài" | On her Bảng tin, tapping a tile (or its heart count) opens who hearted it and every comment with its writer. Hers only: families see the counts as before | Done |
| 69 | "Ở phần điểm danh chuyên cần hãy thêm chế độ chọn cá nhân hoặc chọn nhiều… Cuối trang có phần điểm danh những HS đã chọn theo tiêu chí" | Chuyên cần has **Từng bạn** (the four buttons per child, as before) and **Chọn nhiều bạn**: tap children to pick them, then the bar at the bottom of the screen marks them all Có mặt, Đi muộn, Có phép or Không phép, with an optional reason | Done |

## Her fourteenth brief (26 September 2026, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 70 | "Vòng quay may mắn: tạo hiệu ứng quay 3-4 vòng rồi chậm dần ở tên bạn được chọn" | 3 to 4 turns (supersedes row 39's 2–3), fast then a long slow finish onto the name. `WHEEL_TURNS_*` in `packages/shared/src/games.ts` | Done |
| 71 | "Bắn tên đổi thành: Chiếc mũ bí mật: … một chiếc mũ ảo thuật đặt ngửa, có 1 bàn tay gõ vào chiếc mũ khoảng 3-5s sau tên hiện lên" | **Chiếc mũ bí mật** replaces Bắn tên: an upturned top hat, a hand tapping it with sparkles for 3–5 s (`HAT_TAP_*`), then the name rises out of the hat. Each child once before anyone twice | Done |
| 72 | "Đua vịt: cả lớp cùng đua… tên HS trên mỗi con vịt màu sắc của vịt đa dạng khác nhau… cuộc đua khoảng 5s, có chú vịt lên trước có chú vịt rớt lại phía sau… chú vịt về đích thì hiện tên giữa màn hình" | Every child a drawn duck in one of twelve colours with their name on it; about 5 s (supersedes 5–7 s), with the order changing on the way (each duck's pace is planned in stages, and the winner often comes from behind); the winner's name appears big in the middle of the screen | Done |

## Her fifteenth brief (26 September 2026, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 73 | "Phần thi đua ở bên phía PH và HS hiển thị theo tuần. Ví dụ: Nguyễn mInh Anh 123 giọt nước Tuần này 20 giọt nước" | The family's Thi đua → Vinh danh goes by week only (previous/next week, no Tháng), ranked by the week's drops; the child's own card and every Top 10 row show the total and the week: "123 giọt nước · Tuần này 20 giọt nước" | Done |

## Her sixteenth brief (26 September 2026, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 74 | "Phần chiếc mũ bí mật thiết kế bàn tay cầm gậy ảo thuật làm hành động như ảo thuật chỉ vào mũ và có hiệu ứng biến hình hiện tên được chọn" | A gloved hand with a magic wand waves over the hat and points into it, sparkles trailing; at the end a puff of smoke and stars (the transformation) and the name appears | Done |
| 75 | "Phần đua vịt, các con vịt có thể chen chúc nhau, hiển thị động rộng khoảng 5 làn (nhưng k chia làn) các con vịt đứng sát nhau" | One open pond about five ducks wide, no lane lines; the class crowds in, ducks side by side and overlapping, each named | Done |
| 76 | "Chỉnh sửa phần hiển thị tên đc chọn thành 1 cửa sổ mới giữa màn hình. Hiển thị ngay sau khi hết hiệu ứng chọn tên" | The wheel, the hat and the duck race open one window in the middle of the screen, with the child's photo and name, +1 💧 and Đóng, the moment the effect ends | Done |

## Her seventeenth brief (26 September 2026, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 77 | "Phần Trang chủ của giao diện học sinh. Thể hiện rõ tổng cộng số giọt nước và số giọt nước tuần này" | Under the plant on the child's Trang chủ, two large labelled tiles: **Tổng cộng** and **Tuần này**, each in giọt nước; Lv and the week's rank below | Done |

## Her eighteenth brief (27 September 2026, in chat)

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
| 78 | "Ghi tên tuần (tuần 1 từ 7-9 đến 11/9; tuần 2 (14/9-18/9) tương tự như thế đến hết tuần 35" | School weeks are named "Tuần 1 (07/09 – 11/09)" … "Tuần 35", Monday to Friday, week 1 being the first Monday on or after the start of semester I. The class cover's and the family's "Tuần N" use the same count. `schoolWeeks` in `packages/shared/src/periods.ts` | Done |
| 79 | "Phần thi đua hiển thị kết qủa tuần trước… Chỉ hiển thị kết quả tuần đc giáo viên nhập. Nếu GV chưa nhập thì k hiển thị" | Her Kết quả thi đua opens on last week (the latest finished school week) and she picks any of the 35 from a list that marks the entered ones. Families see only the weeks and months she has entered, newest first; with none entered the tab is not shown to them | Done |

## Decisions made where the brief was silent

- **The teacher is the administrator of her class's accounts** (23 September 2026). Usernames are the given name
  plus four random characters (`an.k7m4`) and passwords are six generated characters (`k9mp42`): two children called An
  never collide, and nobody guesses a classmate's account from their name. **A child's password is stored as the
  teacher reads it out, not hashed**, so a parent who asks on Zalo gets an answer in one tap instead of a reset. The
  cost is stated plainly in migration 0004: whoever reads the database reads every child's password. What is behind it
  is one class's drops, tasks and remarks. The teacher's own password is still hashed with PBKDF2 — hers opens
  everything. A family may still choose their own password; it is kept the same way, and the list marks it
  "Gia đình tự đổi". The list is hidden behind "Hiện mật khẩu" because this screen goes on the classroom TV, and it is
  served `no-store` and only to the class's own teacher.
- **No forced password change.** It existed because `abcd1234` was public and usernames were guessable; neither is true
  now, and it cost every family a hurdle on their first evening.
- **One account per child, shared by child and parents.** Her brief says "tài khoản phụ huynh học sinh" and one area for
  "Học sinh/Phụ huynh". The messages to the teacher are labelled "Gia đình".
- **Usernames are unique across the app**, since sign-in asks for nothing else. The four random characters make that
  automatic; a clash inside one paste is retried, and one against the database is refused so the teacher taps again.
  The teacher can still edit any username.
- **Every child belongs to a tổ.** The class list refuses a child without one, and offers to share them out, because
  the tổ is what the class competes in and what the register and the honour board sort by.
- **Minus points never shrink a plant.** The reference prompt says deductions should be used "theo hướng tích cực". The
  growth stage counts drops earned; the number on the sticker is the net total.
- **Only the teacher redeems a reward** (24 September 2026), in front of the child, and the drops come off then. A
  request that was still pending from the old flow can still be settled; nothing new can land there.
- **Spending drops never lowers a plant.** The stage counts drops earned, the balance counts what is left.
- **Nhiệm vụ is a noticeboard.** Children do their work in their exercise books, as they always have; the app carries
  what she set and the date it is for. Three badges that counted finished quizzes — "Nhà toán học nhí", "Cây bút nhí"
  and "Điểm tuyệt đối" — are now hers to give by hand, so a child who already holds one keeps it, and two new
  automatic ones (300 and 500 drops, and 20 kindnesses) take their place.
- **The Top 10 is visible to families** by default, as in the reference app. One switch in Cài đặt hides it; each family
  then sees only its own child, on the honour roll as well as the Top 10.
- **The board is public within the class.** A comment carries "Phụ huynh <tên con>", so the other families see who
  wrote it, the way a Zalo class group works. Nothing about drops, marks or remarks is on the board.
- **Teachers need an invite code** to register. The setup script generates it and signs the teacher up with it; she can share it with a colleague
  who should have an account on this copy. Nobody else can create an account.
- **Vietnam time throughout.** Weeks run Monday to Sunday; a task due on the 25th closes at midnight on the 25th, Vietnam
  time. Semester dates default to 5 September – 17 January and 18 January – 31 May and are editable per class.
- **Photos are resized in the phone before upload** (avatars 256 px, covers 1600×600, board photos 1400 px) and kept in
  the database, so no paid storage is needed. They are shown only to the class's teacher and its students.
- **A classmate sees the day and month of a birthday, never the year.** The child sees their own full date, and so does
  the teacher. A class needs birthdays to celebrate them; nobody else needs the year.
- **Đi muộn still earns the day's drop.** The child came to school. A lateness she wants to mark is a minus point with
  its own reason, which she controls.
- **An honour freezes the drops it was given for**, so a good week stays a good week however the following week goes.
- **Nhiệm vụ stays a tab of its own.** Her brief offered to delete it ("hoặc xóa luôn vì có thể hiển thị ở bảng tin"),
  then she closed it herself in Zalo: "à thôi, để nguyên Nhiệm vụ đi, cho hắn rõ ràng." It keeps its place in the
  first row.
- **The toolbar is ten buttons** (24 September 2026, evening), because fourteen on one scrolling row is how a
  family's message went unread for two days. Anything that does not earn a place goes one level down: a second
  little row under the tab it belongs to (Tài khoản học sinh, Huy hiệu), the menu by her name (Cài đặt), or the
  screen where it is actually used (the games, on Trang chủ).
- **A child's work is that child's alone.** An avatar and a photo on the board belong to the class; a marked test
  does not. `student_works` is served to the class's teacher and to that one child's account — a classmate gets the
  same 404 as a stranger.
- **The plant is drawn rather than written.** Emoji are a font: 🌰 renders as a brown dot at list size, and two
  stages can look identical across a classroom. Ten SVGs with different silhouettes answer "icon cây to hơn, rõ hơn"
  (24/09) and, in full, "bỏ nước vô là có cây có lá có hoa có quả" (23/09).
- **A child is never finished.** She asked for a level every 100 drops past the ripe fruit, with the picture held
  still. So `levelFor` has no top: `next` is never null, the progress bar never sticks at full, and the plant stops
  changing where she said it should. It also means the prize for being far ahead is a number, not a new picture —
  which is what she wanted, since the drawn stages are the part children compare.

## Open questions for her

1. Should families see the class Top 10, or only their own child? (Default: they see it.)
2. ~~Are the growth steps right for a school year?~~ **Answered** on 24 September: no, and she rewrote them. Row 54.
3. The default rewards and their prices (20 to 100 drops): does she want different ones? She can edit them in the app.
4. Should parents get their own separate login, or is one account per child enough?
5. Nhiệm vụ now only carries what she sets. Is that enough, or does she want a place to tick off who has done it?
6. ~~Does she want written homework photographed and uploaded?~~ **Answered** on 24 September: yes, but the other way
   round — *she* uploads the marked work and the family looks at it ("Sản phẩm của em"). No R2 needed; the photos sit
   in the database like every other picture here.
7. Should a family be able to post a photo to the board, or is writing a comment enough? (Today: comments only.)
8. Should "Ngôi sao của tuần" be suggested automatically at the end of each week, or does she always want to choose?
9. Which chức vụ does her class use? The chips are the usual ones; she can type anything else.
10. ~~"Bỏ nước vô là có cây có lá có hoa có quả khum"?~~ **Answered** on 24 September. Row 54.
11. **"Mần như cái chị gửi em á, k cần tương tác PH"** (24 September, evening). Which screen, and what should stop
    being interactive? It cannot mean the board: her first brief asks for likes and comments there in writing.

## Requirements from this class

Rows the teacher who owns this copy asked for, numbered on from the last row above. Each says which earlier row it
replaces, if any.

| # | She asked for | Where it is | Status |
| --- | --- | --- | --- |
