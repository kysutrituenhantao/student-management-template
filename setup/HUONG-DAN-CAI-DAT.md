# Cài Lớp Học Hạnh Phúc cho lớp của cô

Sau khi cài, cô có **trang web riêng cho lớp mình** (học sinh, phụ huynh đăng nhập được) và cô **nhắn cho Claude
trên điện thoại** để thêm, sửa tính năng, giống như nhắn cho một đồng nghiệp giỏi máy tính. Cô không cần biết lập
trình.

Chiếc máy tính xách tay sẽ là "xưởng" của Claude: **để ở nhà, luôn cắm sạc, luôn bật**. Cô dùng điện thoại là chính.

⏱ Khoảng **1 tiếng**, phần lớn là chờ máy tự làm. Chỉ cần làm một lần.

---

## Chuẩn bị (làm trước, trên điện thoại hay máy tính đều được)

| | Việc cần làm | Chi phí |
| --- | --- | --- |
| 1 | Máy tính xách tay **Windows 10 hoặc 11**, còn trống khoảng 30 GB | — |
| 2 | Tạo tài khoản **GitHub** tại https://github.com/signup (nơi cất mã của ứng dụng) | Miễn phí |
| 3 | Tạo tài khoản **Cloudflare** tại https://dash.cloudflare.com/sign-up (nơi chạy trang web). **Mở email, bấm xác nhận.** | Miễn phí |
| 4 | Đăng ký **Claude Pro** (hoặc Max) tại https://claude.ai, cài ứng dụng **Claude** trên điện thoại và đăng nhập cùng tài khoản đó | Theo gói Claude |
| 5 | *(Không bắt buộc, làm sau cũng được)* Mua **tên miền** riêng, ví dụ `lophoccohanh.online`, tại https://www.namecheap.com | Khoảng 20.000–50.000đ năm đầu |

Chưa có tên miền thì trang web vẫn chạy ở địa chỉ miễn phí dạng `lop-hoc-hanh-phuc.<tên>.workers.dev`.

Ghi các mật khẩu vào một chỗ an toàn.

---

## Bước 1 · Trên Windows (5 phút + 1 lần khởi động lại)

1. Bấm nút **Start**, gõ `PowerShell`, **chuột phải** vào Windows PowerShell → **Run as administrator** → **Yes**.
2. Dán dòng này vào (chuột phải để dán) rồi bấm **Enter**:

   ```
   irm https://raw.githubusercontent.com/haophuongwedding/student-management-template/master/setup/windows.ps1 | iex
   ```

3. Nếu máy báo **cần khởi động lại**: khởi động lại, rồi làm lại đúng bước 1 và 2.

Máy sẽ tự: giữ máy luôn thức khi cắm sạc (**gập máy lại vẫn chạy**), cài Cursor, cài Ubuntu.

## Bước 2 · Trong cửa sổ Ubuntu (30–45 phút)

Cuối bước 1, cửa sổ Ubuntu tự mở:

1. Ubuntu hỏi **username**: gõ chữ thường không dấu, ví dụ `cohanh`, Enter.
   Rồi hỏi **password** hai lần: gõ (không hiện chữ, cứ gõ) rồi Enter. **Ghi lại mật khẩu này.**
2. Khi thấy dòng chữ kết thúc bằng `$`, **chuột phải** để dán dòng lệnh (máy đã chép sẵn), Enter. Nếu cần gõ tay:

   ```
   bash <(curl -fsSL https://raw.githubusercontent.com/haophuongwedding/student-management-template/master/setup/setup.sh)
   ```

3. Làm theo chữ trên màn hình. Máy sẽ nhờ cô:
   - gõ mật khẩu Ubuntu vừa đặt;
   - **đăng nhập GitHub** (chép mã 8 ký tự, dán vào trang GitHub);
   - trả lời: học sinh gọi cô là gì, lớp nào, trường nào;
   - **đăng nhập Cloudflare**, rồi tạo một "chìa khoá": trang đã điền sẵn, cô chỉ bấm **Continue to summary** →
     **Create Token** → **Copy**, rồi dán vào cửa sổ Ubuntu;
   - chờ khoảng 15 phút để máy kiểm tra và đưa trang web lên mạng;
   - chọn **tên đăng nhập và mật khẩu giáo viên** cho trang web;
   - **đăng nhập Claude**, rồi gõ `/exit` khi thấy ô gõ chữ.
4. Cuối cùng, một cửa sổ "đường dây" mở ra. Nếu hỏi `Enable Remote Control?` thì gõ `y`, Enter.
   **Thu nhỏ cửa sổ này, đừng đóng.**

Nếu có bước nào báo lỗi: **chạy lại đúng dòng lệnh ở mục 2**. Máy bỏ qua những gì đã xong và làm tiếp.

## Bước 3 · Dùng trên điện thoại

1. Mở ứng dụng **Claude** → mục **Code**.
2. Chọn máy có tên **"Lớp … – Cô …"**.
3. Nhắn như nhắn cho đồng nghiệp:
   - *"Cô muốn đổi tên ứng dụng thành Lớp Học Yêu Thương."*
   - *"Thêm cho cô mục điểm danh buổi chiều."*
   - *"Cô vừa mua tên miền lophoccohanh.online, chuyển trang web sang đó giúp cô."*
   - Hoặc gửi một **file Word** ghi các điều cô muốn (chữ **đỏ** là việc cần làm, chữ **đen** là đã ổn).
4. Claude tự làm, tự kiểm tra, tự đưa lên mạng, rồi báo: *"Cô mở mục … là thấy nha cô."*

Trang web của lớp và mã mời cho đồng nghiệp được in ra ở cuối bước 2. Cách dùng trang web (tạo lớp, thêm học sinh,
in tài khoản cho phụ huynh): `docs/HUONG-DAN-SU-DUNG.md`.

---

## Giữ máy chạy

- Luôn **cắm sạc**. Gập máy được, nhưng đừng tắt nguồn.
- Nếu máy **khởi động lại** (mất điện, Windows cập nhật): chỉ cần **đăng nhập Windows** là đường dây tự mở lại.
  Không cần làm gì thêm.
- Mở cài đặt Windows Update → **Advanced options** → **Active hours**, đặt giờ cô hay dùng để Windows không tự
  khởi động lại lúc đó.

## Khi có trục trặc

| Hiện tượng | Cách xử lý |
| --- | --- |
| Bước 1 báo lỗi có mã `0x80370102` hoặc "Virtual Machine Platform" | Máy chưa bật ảo hoá trong BIOS. Nhờ người biết máy bật **Virtualization (VT-x/AMD-V)**, rồi làm lại bước 1 |
| Điện thoại không thấy máy trong mục Code | Trên máy tính, mở cửa sổ "Lop Hoc Hanh Phuc" ở thanh tác vụ. Nếu đã lỡ đóng: khởi động lại máy |
| Claude trên điện thoại báo cần đăng nhập lại GitHub hay Cloudflare | Trên máy tính, mở **Ubuntu** từ menu Start, dán lại dòng lệnh ở bước 2 |
| Muốn ngồi máy tính gõ trực tiếp với Claude | Mở **Ubuntu**, gõ `lophoc`, Enter |

Dữ liệu của lớp (học sinh, điểm, ảnh) nằm trên Cloudflare, **không nằm trong máy tính**. Máy hỏng, mất máy thì dữ
liệu vẫn còn; cài lại máy mới theo hướng dẫn này là dùng tiếp.
