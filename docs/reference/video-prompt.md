# The reference video: what it shows

The first teacher forwarded a 1 min 53 s TikTok screen recording (from @nln.phgg_35). It is not in the repo (`*.mp4` is
ignored); it lives next to it as `2aOboR0S7eCxbTsJ6Zlpt1Bx8RR9dzhdnQBrVE3M.mp4`. The narration is a generic
tutorial: write a prompt in ChatGPT, paste it into Google AI Studio → Build → New app, refine in the chat, publish.

It shows three things:

1. The finished app, "Lớp học cô Phương – Tràn ngập yêu thương": an offline, frontend-only classroom app (a "Chế độ
   ngoại tuyến" badge; "Giáo viên / Học sinh" toggle; tabs Chấm Điểm, Sơ Đồ Lớp, Lớp & Tổ, Học Sinh, Đổi Quà, Huy Hiệu,
   Trò Chơi, Yêu Thương; a Top 10 of the week; animal-emoji students with points and team tags; a seating chart with a
   green board and the teacher's desk).
2. The ChatGPT prompt that built it, scrolling past quickly. About half of it never appears on screen.
3. A follow-up prompt that reworks the cover photo and the scoring.

Transcribed frame by frame from the recording. Gaps are marked; nothing is filled in.

## Her messages to ChatGPT

> bạn hãy đóng vai chuyên gia tạo câu lệnh tạo app, hãy giúp tôi viết câu lệnh tạo app quản lí có tên ' Lớp học cô
> Phương - Tràn ngập yêu thương'

> Sửa giúp tôi prompt phần giao diện, có phần tải ảnh lên để sửa được ảnh bìa thành ảnh cả lớp. Phần tích điểm cộng trừ
> sao tích hợp vào phần stiker học sinh ( dấu cộng trừ) để tiện cộng trừ

## The main prompt (visible parts)

```
# PROMPT TẠO ỨNG DỤNG QUẢN LÝ LỚP HỌC

Hãy đóng vai chuyên gia UX/UI, lập trình viên Full-stack và chuyên gia thiết kế hệ thống quản lý lớp học tiểu học,
đồng thời là chuyên gia Gamification dành cho học sinh 10–11 tuổi.

Hãy xây dựng một web app quản lý lớp học hiện đại, đáng yêu, trực quan, dễ sử dụng trên máy tính, máy tính bảng và
điện thoại với tên:

## 🌸 LỚP HỌC CÔ PHƯƠNG – TRÀN NGẬP YÊU THƯƠNG 🌸

[… không thấy trong video …]
lớp 5, kết hợp giữa quản lý lớp học + thi đua + gamification + phần thưởng + theo dõi tiến bộ + AI hỗ trợ giáo viên.

Mục tiêu của ứng dụng:
> "Mỗi ngày đến lớp là một ngày vui – mỗi cố gắng đều được ghi nhận – mỗi học sinh đều được yêu thương."

## 1. PHONG CÁCH THIẾT KẾ
- 3D chibi
- Dễ thương, hiện đại, thân thiện với trẻ em
- Không quá trẻ con
- Màu chủ đạo: hồng pastel + xanh pastel + trắng + vàng nhẹ
[… không thấy trong video …]
- Có animation nhẹ khi cộng điểm, nhận huy hiệu và lên cấp
- Giao diện sạch, không rối
- Chữ tiếng Việt rõ ràng, dễ đọc
- Responsive trên máy tính, tablet và điện thoại
Không sử dụng hình ảnh gây sợ hãi, bạo lực hoặc quá game hóa.

## 2. CẤU TRÚC ỨNG DỤNG
Ứng dụng gồm 2 khu vực chính:

### A. KHU VỰC GIÁO VIÊN
Giáo viên đăng nhập bằng tài khoản quản trị.
Dashboard gồm:
1. Tổng số học sinh
2. Điểm thi đua hôm nay
3. Học sinh nổi bật
4. Học sinh cần được động viên
5. Bảng xếp hạng
6. Hoạt động gần đây
7. Nhiệm vụ hôm nay
8. Huy hiệu mới nhận
9. Thống kê điểm theo tuần/tháng

## 3. QUẢN LÝ HỌC SINH
Cho phép giáo viên:
- Thêm học sinh
- Sửa thông tin học sinh
- Xóa học sinh
- Tạo avatar cho học sinh
- Gán học sinh vào tổ/nhóm
- Xem hồ sơ từng học sinh
[… có thể còn nội dung …]

## 4. HỆ THỐNG ĐIỂM THI ĐUA
Giáo viên có thể cộng điểm bằng các nút nhanh:
⭐ +1 điểm: Có ý thức tốt
⭐ +2 điểm: Phát biểu xây dựng bài
⭐ +3 điểm: Hoàn thành nhiệm vụ xuất sắc
⭐ +5 điểm: Giúp đỡ bạn
⭐ +5 điểm: Việc tốt trong ngày
⭐ +10 điểm: Thành tích đặc biệt
Các nút trừ điểm cũng có nhưng phải sử dụng theo hướng tích cực:
-1 điểm: Chưa hoàn thành nhiệm vụ
[… không thấy trong video: phần còn lại, mục 5 trở đi, danh sách chức năng 1–14 …]

15. Vòng quay
16. Lật thẻ
17. Đua vịt
18. Chia nhóm
19. Góc yêu thương
20. Sao lưu
21. Khôi phục
22. Offline hoàn toàn
23. PWA/cài đặt trên thiết bị

Không tạo bản demo chỉ có giao diện. Hãy tạo ứng dụng có logic hoạt động thực tế và dữ liệu được lưu lại.
```

## The follow-up prompt (visible parts)

```
# 🔧 PHẦN CẬP NHẬT GIAO DIỆN VÀ TÍCH ĐIỂM

## 1. 🖼️ ẢNH BÌA LỚP – CÓ THỂ TẢI ẢNH CẢ LỚP
Ảnh bìa chiếm diện tích lớn ở đầu trang. Mặc định có ảnh nền minh họa lớp học 3D chibi.
Nút "🖼️ THAY ĐỔI ẢNH BÌA" → "📷 TẢI ẢNH LÊN" (cắt, zoom, căn chỉnh).
Trên ảnh bìa: 🌸 tên lớp, ❤️ khẩu hiệu, 🧑‍🏫 tên giáo viên, 👧👦 số học sinh.
Có thể điều chỉnh độ tối của lớp phủ để chữ luôn rõ. Không làm ảnh cả lớp bị che quá nhiều.

## 3. 👧👦 KHU VỰC HIỂN THỊ HỌC SINH
Sticker: [AVATAR] – TÊN – ⭐ Level – XP – −⭐ +⭐

## 4.–7. CỘNG / TRỪ ĐIỂM NGAY TRÊN STICKER
Bấm +⭐ → cộng ngay, hiện "+1 ⭐", không chuyển trang.
Nhấn giữ hoặc nhấn vào số điểm → menu "⭐ CỘNG NHANH": +1, +2, … +5.
−⭐ đặt ngay dưới sticker, bấm → trừ 1 điểm, animation nhẹ.

## 9. 📝 LÝ DO CỘNG/TRỪ ĐIỂM
Không bắt giáo viên nhập lý do mỗi lần. Muốn ghi lý do: "📜 LỊCH SỬ" hoặc "Thêm lý do".
✋ Phát biểu · 📚 Chăm chỉ · 💗 Việc tốt · 🤝 Giúp bạn · 🎤 Tự tin · 🎨 Sáng tạo · 🌟 Tiến bộ · 🏆 Thành tích
Giáo viên có thể tự thêm lý do.

## 10.–15. THAO TÁC NHANH, MÁY TÍNH, LỌC THEO TỔ, TÌM KIẾM
Nút −⭐ và +⭐ đủ lớn, không quá sát nhau. Máy tính: 5–8 học sinh một hàng; tìm kiếm, lọc theo tổ, sắp xếp theo tên.
Tab: TẤT CẢ · TỔ 1 · TỔ 2 · TỔ 3 · TỔ 4. Thứ hạng thay đổi nếu cần.

## 16. 🎉 HIỆU ỨNG KHI CỘNG ĐIỂM
✨ ⭐ ✨ và +1 quanh avatar, biến mất sau 0,5–1 giây, không gián đoạn thao tác. +5 ⭐ hiện lớn hơn.

## 17. KHI LÊN LEVEL
Popup "🎉 CHÚC MỪNG! 🌟 MINH ANH ĐÃ LÊN LEVEL 5!" với pháo giấy, sao, huy hiệu mới. Nút "❤️ TUYỆT VỜI!".

## 18. 🖼️ AVATAR HỌC SINH
Sticker có sẵn hoặc ảnh giáo viên tải lên. Thay ảnh không làm mất tên, điểm, XP.

## Màu chủ đạo: 🌸 Hồng pastel · 💙 Xanh pastel · 💛 Vàng nhạt · 🤍 Trắng
## Trang trí: ⭐ Ngôi sao · ❤️ Trái tim · 🌈 Cầu vồng · ☁️ Mây · 📚 Sách

## Bố cục trang chủ
[ẢNH BÌA LỚP] → 🌸 Tên lớp, ❤️ Slogan → 🏆 TOP 10 TUẦN NÀY → 👧👦 VƯỜN SAO CỦA LỚP → 🎡 Gọi ngẫu nhiên, 👥 Chia nhóm

## 22. YÊU CẦU QUAN TRỌNG
Hãy ưu tiên thao tác trực tiếp trên màn hình chính.
```
