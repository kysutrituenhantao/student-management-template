# Hướng dẫn sử dụng Lớp Học Hạnh Phúc

Dành cho cô giáo chủ nhiệm. Đọc một lần là dùng được, mỗi mục chỉ vài bước.

Ứng dụng có hai khu vực:

- **Trang giáo viên** (`/giao-vien/`): cô quản lý lớp, chấm điểm, đăng bảng tin, điểm danh, giao nhiệm vụ, xem báo
  cáo, vinh danh và nhắn tin với phụ huynh.
- **Trang học sinh và phụ huynh** (`/dang-nhap/`): mỗi con một tài khoản, bố mẹ và con dùng chung. Con làm nhiệm vụ,
  xem vườn hoa của mình, đổi quà; bố mẹ xem bảng tin lớp, kết quả, chuyên cần, lời phê của cô và nhắn tin cho cô.

**Thanh công cụ của cô là một hàng, 10 mục:**

🏠 Trang chủ · 📌 Bảng tin · 📚 Nhiệm vụ · 🌱 Hồ sơ Măng non · 📅 Chuyên cần · 🪑 Sơ đồ lớp · 📊 Báo cáo ·
🏆 Thi đua · 🎁 Đổi thưởng · 💌 Lời nhắn

Trên máy tính, cả 10 mục nằm trên một hàng. Trên điện thoại hay máy tính bảng nhỏ, các mục thành những ô nhỏ (hình ở
trên, chữ ở dưới) để cô vẫn thấy đủ 10 mục mà không phải kéo ngang hay thu nhỏ trang.

Vài mục có **hai tab nhỏ** nằm bên trong: **Hồ sơ Măng non** có *Hồ sơ Măng non – Tài khoản học sinh*, **Thi đua**
có *Kết quả thi đua – Vinh danh – Huy hiệu*, **Đổi thưởng** có *Đổi thưởng – Điểm cộng – Điểm trừ*. **Cài đặt lớp** nằm trong menu tên cô ở góc trên bên phải. Các trò chơi nằm ngay ở
**Trang chủ**, trong nút **Gọi ngẫu nhiên** và **Chia nhóm**.

---

## 1. Tạo tài khoản giáo viên

Bước cài đặt đã tạo sẵn tài khoản cho cô (tên đăng nhập và mật khẩu cô chọn lúc cài). Chỉ cần mở trang web, bấm
**Giáo viên** rồi đăng nhập. Muốn tạo thêm tài khoản cho một đồng nghiệp:

1. Mở trang web, bấm **Giáo viên**, rồi **Tạo tài khoản giáo viên**.
2. Nhập **mã mời** (in ra ở cuối bước cài đặt, và lưu trong máy tính ở `~/.lop-hoc/ma-moi.txt`), **tên hiển thị** (ví dụ: Cô Hạnh, học sinh và phụ huynh sẽ thấy tên này),
   **tên đăng nhập** và **mật khẩu** (ít nhất 8 ký tự).
3. Bấm **Tạo tài khoản**. Lần sau chỉ cần đăng nhập.

Quên mật khẩu giáo viên thì nhắn cho Claude trên điện thoại: "Cô quên mật khẩu giáo viên" — Claude sẽ hướng dẫn.

## 2. Tạo lớp

1. Bấm **Tạo lớp mới**.
2. Điền tên lớp (ví dụ: Lớp 4A), khối, năm học, số tổ.
3. Bấm **Tạo lớp**. Ứng dụng mở ngay bảng thêm học sinh.

Tài khoản của học sinh do ứng dụng tạo theo mẫu **tên lót + tên + ngày sinh** (`minhanh27`), mật khẩu ban đầu
**Abc12345** — cô không phải nghĩ gì cả, và xem lại được bất cứ lúc nào để gửi phụ huynh.

## 3. Thêm học sinh cả lớp một lần

1. Dán danh sách lớp vào ô lớn, **mỗi bạn một dòng: họ tên, ngày sinh, tổ** — ví dụ `Trần Hoài An, 22/11/2016, 2`.
   Dán thẳng bảng từ Word, Excel hay Zalo đều được, số thứ tự ở đầu dòng tự bỏ qua, tên viết HOA sẽ tự sửa thành
   Nguyễn Văn An. Ngày sinh cũng tự ghi vào Hồ sơ Măng non của con.
2. **Bạn nào cũng cần có tổ**: thêm dấu phẩy và số tổ — `Trần Hoài An, 22/11/2016, 2`. Dán xong mà còn bạn chưa có tổ thì
   bấm **Chia tổ tự động**, ứng dụng chia đều giúp cô.
3. Bên phải hiện danh sách xem trước. Kiểm tra rồi bấm **Tạo … tài khoản**.

Mỗi con có:

- **Tên đăng nhập**: tên lót, tên và ngày sinh của con, không dấu — Nguyễn Thị Minh Anh sinh ngày 27 là `minhanh27`,
  Trần Hoài An sinh ngày 22 là `hoaian22`, sinh ngày mùng 1 là `…01`. Hai bạn trùng nhau thì bạn sau có thêm một chữ
  cái (`minhanh27b`). Bạn nào chưa có ngày sinh thì chỉ có tên (`hoaian`).
- **Mật khẩu**: **Abc12345**, cả lớp giống nhau.
- **Lần đầu vào lớp**, gia đình đặt một **mật khẩu riêng** rồi mới vào được — vì cả lớp dùng chung Abc12345, ai biết
  tên và ngày sinh của con cũng đoán được tài khoản. Cô vẫn xem được mật khẩu riêng đó.

Đăng nhập không phân biệt chữ hoa chữ thường, dấu hay khoảng trắng: gõ `minhanh27`, `MINHANH27` hay `Minh Anh 27` đều
vào được.

**Lớp đã tạo tài khoản theo kiểu cũ** (`an.k7m4`): trong **Tài khoản học sinh**, bấm **Tạo lại tài khoản cả lớp theo
mẫu**. Cả lớp có tên đăng nhập mới và mật khẩu Abc12345; giọt nước, hồ sơ và mọi thứ khác của con giữ nguyên. Nhà nào
đang đăng nhập sẽ bị đăng xuất, nên cô in phiếu mới gửi lại cả lớp nhé.

## 4. Gửi tài khoản cho phụ huynh

Mục **Hồ sơ Măng non → Tài khoản học sinh** → **In phiếu tài khoản**. Mỗi con một phiếu (trang web, tên đăng nhập, mật khẩu), 10 phiếu một trang
A4, cắt ra gửi về nhà.

**Phụ huynh hỏi lại lúc nào cũng được.** Trong mục **Tài khoản học sinh**, mật khẩu để ẩn (`••••••`) cho an toàn khi cô chiếu lên
TV. Bấm **Hiện mật khẩu** để xem, hoặc bấm nút 📋 ở cạnh tên để **sao chép** tài khoản của con rồi dán vào Zalo gửi
riêng cho phụ huynh. Gia đình tự đổi mật khẩu thì cô vẫn xem được mật khẩu mới (dòng đó ghi *Gia đình tự đổi*).

Tin nhắn mẫu gửi nhóm Zalo phụ huynh:

> Kính gửi quý phụ huynh lớp 4A. Lớp mình dùng ứng dụng **Lớp Học Hạnh Phúc** để theo dõi việc học của các con.
> Bố mẹ vào trang [địa chỉ trang web], chọn **Học sinh và phụ huynh**, đăng nhập bằng tên đăng nhập và mật khẩu trên
> phiếu cô gửi. Lần đầu vào, bố mẹ đặt một mật khẩu riêng cho nhà mình; quên thì nhắn cô. Trên ứng dụng, bố mẹ xem được
> bảng tin của lớp, điểm tốt con nhận mỗi ngày, việc cô giao, lời nhận xét của cô, và nhắn tin trực tiếp cho cô.
> Cảm ơn quý phụ huynh.

Trong mục **Tài khoản học sinh**, dòng nào ghi **Chưa vào lớp** là gia đình đó chưa đăng nhập lần nào.

## 5. Chấm điểm hằng ngày (vườn hoa điểm tốt)

Ở **Trang chủ** của lớp, cả lớp hiện trong **Vườn hoa của lớp**: mỗi con một dòng — ảnh, tên, cây của con (Lv), tổ và
số giọt nước. Thích kiểu sticker ô vuông như trước thì bấm **▦ Ô vuông**; ứng dụng nhớ kiểu cô chọn cho lần sau.
Mỗi điểm cộng là **một giọt nước 💧** tưới cho cây của con.

- Bấm **+💧** để cộng 1 điểm, bấm **−💧** để trừ 1 điểm. Không cần chọn lý do.
- **Bấm vào số giọt nước** (hoặc giữ nút +💧) để mở bảng chấm điểm. Ở trên là các **tiêu chí** kèm số giọt nước
  (ví dụ *📚 Chăm chỉ +2 💧*, *📝 Không làm BT −2 💧*): **bấm một tiêu chí là chấm ngay** đúng số giọt ấy. Ở dưới vẫn
  có +1, +2, +3, +5, +10 và −1, −2, −3, −5 để chấm nhanh không cần tiêu chí.
- **Tiêu chí** do cô đặt: mục **Đổi thưởng → Điểm cộng** và **Đổi thưởng → Điểm trừ**. Bấm ✏️ để đổi tên hay số giọt
  nước, 🗑 để xoá, **Thêm điểm cộng / Thêm điểm trừ** để thêm. Tiêu chí có sẵn đều bắt đầu ở 1 giọt, cô sửa lại theo
  lớp mình.
- Sau mỗi lần chấm, thanh dưới cùng có **Thêm lý do** (ghi lý do cho lần vừa chấm) và **Hoàn tác** (bấm nhầm thì bấm).
- **Chọn nhiều bạn**: chọn cả lớp, cả tổ hoặc từng bạn, rồi bấm **Chấm điểm** để cộng cho tất cả một lần.
- **Lịch sử**: xem mọi lần chấm, thêm hoặc đổi lý do, xoá lần chấm sai.
- Lọc theo tổ, tìm tên, sắp xếp theo tên hay nhiều giọt nước nhất ở hàng trên.
- **Gọi ngẫu nhiên**: chọn cách gọi — **Gọi nhanh**, **Vòng quay may mắn**, **Bắn tên** hay **Đua vịt** — gọi xong
  bấm **+1 💧** cho bạn được gọi luôn.

Đủ giọt nước thì **cây của con lớn lên**, màn hình bắn pháo giấy chúc mừng:

| Cây | Cần |
| --- | --- |
| 🌰 Hạt giống | 0 |
| 🌱 Nảy mầm | 10 giọt |
| 🌿 Hai lá mầm | 50 giọt |
| ☘️ Lá con | 100 giọt |
| 🪴 Cây con | 150 giọt |
| 🌳 Cây xanh tốt | 200 giọt |
| 🌷 Cây ra nụ | 250 giọt |
| 🌸 Cây nở hoa | 300 giọt |
| 🍏 Cây có quả | 400 giọt |
| 🍎 Quả chín | 500 giọt |

**Sau 500 giọt**, cứ thêm **100 giọt** là con lên **1 level** nữa (Lv 11, Lv 12…). Cây vẫn là cây quả chín, chỉ có số
level tăng lên — để bạn nào chăm vẫn còn mục tiêu tới cuối năm học.

Trừ điểm **không bao giờ** làm cây của con nhỏ lại.

**Chiếu lên TV trong lớp**: bấm nút phóng to ở góc trên bên phải để toàn màn hình, nút loa để bật tiếng "ting" khi
cộng điểm.

Bên phải là **Top 10 tuần này**, **Hoạt động gần đây**, **Cần cô động viên** (các bạn chưa có giọt nước nào tuần này)
và **Huy hiệu mới**.

**Ảnh bìa**: bấm **Tải ảnh cả lớp** trên bảng xanh để dùng ảnh chụp cả lớp làm ảnh bìa.

## 6. Bảng tin lớp học

Mục **Bảng tin** là bảng của lớp mình, giống Padlet: mỗi ô là một tờ giấy màu dán lên bảng. Phụ huynh đăng nhập bằng
tài khoản của con là xem được, thả tim và bình luận.

1. **Chủ đề tháng**: bấm **Chủ đề tháng** để ghi chủ điểm (ứng dụng gợi ý sẵn theo tháng, ví dụ tháng 9 "Mái trường
   mến yêu", tháng 11 "Biết ơn thầy cô giáo"). Đổi tháng bằng mũi tên ← → ở trên.
2. **Thêm ô tin**: chọn loại ô
   - 📸 **Hoạt động của lớp** – ảnh và vài dòng kể lại buổi học, buổi sinh hoạt.
   - 🏠 **Việc ở nhà** – việc các con làm ở nhà hôm nay, ghi rõ **Làm cho ngày** để phụ huynh theo dõi.
   - 💌 **Lời nhắn** – nhắn nhanh tới cả lớp và phụ huynh.
3. Chọn **màu giấy** (6 màu), **kiểu ô** và **sticker** dán lên góc ô:
   - **Kiểu ô**: *Giấy ghim* (tờ giấy có ghim ở trên), *Nhãn dán* (mép cong, hơi nghiêng như miếng dán trong vở),
     *Khung ảnh* (viền dày, hợp với ô có ảnh), *Bảng con* (nền xanh như bảng lớp, chữ sáng — nổi bật giữa các ô khác).
   - **Sticker**: 30 hình ⭐ 🌈 🎉 🏆 📚 🎨 🍎 🦋… hoặc chọn **Không** nếu không muốn dán.
   Bấm **Ghim lên đầu bảng** nếu muốn ô đó luôn nằm trên cùng.
4. **Thêm ảnh**: tối đa 6 ảnh mỗi ô. Ảnh được thu nhỏ ngay trên máy cô trước khi gửi, nên không tốn dung lượng.
5. Dưới mỗi ô có số tim và **Bình luận**. Cô trả lời phụ huynh ngay trong ô, và xoá được bình luận không phù hợp.
6. **Bấm vào một ô** (hoặc vào số tim) để xem **bạn nào đã thích** và **ai đã bình luận gì**. Chỉ cô xem được danh
   sách này.

## 7. Hồ sơ Măng non

Mục **Hồ sơ Măng non** là quyển sổ của lớp: mỗi con một trang có ảnh, tổ, **chức vụ**, **ngày sinh**, **giới tính**,
**sở thích** và **ước mơ**.

- Bấm vào một trang để sửa. Chức vụ chọn nhanh: Lớp trưởng, Lớp phó học tập, Tổ trưởng… hoặc cô tự ghi.
- Con đăng nhập cũng **tự ghi trang của mình** (sở thích, ước mơ, ngày sinh, giới tính). **Chức vụ chỉ cô ghi.**
- Ở trên có **Sinh nhật tháng này**, để lớp mình chúc mừng bạn.
- Các bạn trong lớp chỉ thấy **ngày và tháng sinh** của nhau, không thấy năm sinh.

### 🎒 Sản phẩm của em

Trong trang Măng non của mỗi con, kéo xuống cuối là mục **Sản phẩm của em**.

1. Ghi **Tên sản phẩm** nếu muốn (ví dụ: *Bài kiểm tra Toán tuần 5*) — không bắt buộc.
2. Bấm **📷 Thêm ảnh sản phẩm** và chọn ảnh bài kiểm tra, bài làm hay sản phẩm con làm. **Ảnh lưu ngay, không cần
   bấm Lưu.**
3. Gia đình con thấy ảnh ở mục **Kết quả** trong tài khoản của con, cũng với tên **Sản phẩm của em**. Phụ huynh
   **chỉ xem, không tải về được**, và **các bạn khác trong lớp không nhìn thấy** — đây là bài của riêng con.
4. Muốn gỡ ảnh xuống: bấm 🗑 ở góc ảnh.

## 8. Theo dõi chuyên cần

Mục **Chuyên cần**, mỗi ngày một lần:

- Chạm một lần vào **Có / Muộn / Phép / Không phép** của từng bạn là lưu ngay, không cần bấm Lưu.
- Bạn nào **có mặt** hoặc **đi muộn** được cộng luôn **1 💧** của ngày hôm đó — màn hình báo "Đã điểm danh và cộng
  1 💧 cho N bạn" và ghi tổng số giọt nước chuyên cần đã tặng hôm nay. Chấm đi chấm lại cũng chỉ 1 giọt một
  ngày. Nếu cô sửa lại thành nghỉ học, giọt nước đó được thu về.
- **Cả lớp có mặt**: một nút cho cả lớp, những bạn cô đã đánh dấu nghỉ vẫn giữ nguyên.
- Có hai cách điểm danh: **👆 Từng bạn** (bấm nút trên thẻ của từng con) và **☑️ Chọn nhiều bạn**: chạm vào thẻ các
  bạn cần điểm danh (ví dụ ba bạn đi muộn), rồi ở **thanh cuối trang** chọn **Có mặt / Đi muộn / Nghỉ có phép / Nghỉ
  không phép** — các bạn đã chọn được điểm danh cùng lúc. Ghi **lý do** ở thanh đó nếu các con nghỉ. Cách hay dùng:
  bấm **Cả lớp có mặt** trước, rồi chọn nhiều bạn đi muộn hay nghỉ để sửa lại.
- Bạn nghỉ thì ghi **lý do** (ví dụ: "Con bị sốt"), phụ huynh xem được.
- Bên dưới là **Bảng chuyên cần** theo tuần, tháng, học kỳ hoặc năm học.
- Muốn điểm danh bù cho hôm trước thì đổi **Ngày điểm danh** (không chọn được ngày chưa tới).

## 9. Thi đua

Mục **Thi đua** có ba tab nhỏ.

**📊 Kết quả thi đua** — kết quả thi đua của các lớp trong trường:

1. Mục này mở sẵn **tuần trước**. Các tuần có tên theo tuần học: **Tuần 1 (07/09 – 11/09)**, **Tuần 2 (14/09 – 18/09)**…
   đến **Tuần 35**. Chọn tuần trong danh sách hoặc bấm ‹ ›; tuần nào cô đã nhập có dấu ✓. Muốn nhập theo tháng thì
   chọn **Tháng**.
2. Bấm **Nhập kết quả**. Dòng tô hồng là lớp của cô (đã ghi sẵn tên). Bấm **Thêm lớp** để thêm từng lớp, ghi tên lớp và
   điểm (ghi 97,5 hay 97.5 đều được), rồi bấm **Lưu**.
3. Biểu đồ cột tự xếp **từ cao đến thấp**, **lớp mình luôn là cột màu đỏ**, và ghi rõ lớp mình đứng thứ mấy.
4. Sang tuần sau, bấm **Nhập kết quả** là đã có sẵn danh sách các lớp của lần trước, cô chỉ cần ghi điểm.

Phụ huynh và các con xem được biểu đồ này trong mục **Thi đua** của mình (chỉ xem, không sửa được) — **chỉ những tuần
cô đã nhập**, tuần mới nhất mở trước. Khi cô chưa nhập tuần nào, phụ huynh chưa thấy mục Kết quả thi đua.

**🌟 Vinh danh** — như trước: Ba bạn nhiều giọt nước nhất kỳ này đứng trên bục: **👑 Quán quân** ở giữa, **🥈 Á quân 1** bên
trái, **🥉 Á quân 2** bên phải; từ hạng 4 trở đi xếp theo danh sách bên dưới.

1. Chọn kỳ: **Tuần / Tháng / Học kỳ / Năm học**.
2. Ứng dụng xếp sẵn bảng **bạn nào nhiều giọt nước nhất kỳ này**. Chạm vào tên để chọn (chọn được nhiều bạn); bạn không
   nằm trong bảng thì mở **Chọn bạn khác trong lớp**.
3. Bấm **Vinh danh**, sửa danh hiệu nếu muốn (mặc định: Ngôi sao của tuần / tháng / học kỳ / năm) và viết lời khen.
4. **Bảng vinh danh** ở dưới giữ lại tất cả bằng khen; bấm **In bảng** để in hoặc chiếu lên TV. Gia đình xem được
   trong mục **Thi đua → Vinh danh**, cùng với **con mình đứng thứ mấy trong lớp** theo từng tuần — mỗi bạn hiện cả
   tổng giọt nước và số giọt của tuần, ví dụ *Nguyễn Minh Anh — 123 giọt nước — Tuần này 20 giọt nước* (và Top 10 của
   lớp nếu cô cho phụ huynh xem trong Cài đặt).

**🏅 Huy hiệu** — bấm ✏️ trên mỗi huy hiệu để đổi **biểu tượng, tên và nội dung** theo ý cô. Huy hiệu ứng dụng tự trao
(✨) vẫn giữ nguyên mốc, chỉ đổi chữ và biểu tượng. Phụ huynh chỉ thấy **những huy hiệu con mình đã có**.

Số giọt nước ghi trên bằng khen là số của kỳ đó, về sau không thay đổi nữa.

## 10. Giao nhiệm vụ

Mục **Nhiệm vụ** → **Giao nhiệm vụ mới**. Đây là chỗ cô ghi việc cần làm cho cả lớp; **các con làm vào vở như bình
thường, không nộp bài trên ứng dụng**.

1. **Tên nhiệm vụ**: ví dụ "Thứ Năm ngày 24/9/2026" hay "Ôn tập bảng nhân 7". Không cần chọn môn.
2. **Nội dung cô giao**: cô ghi rõ việc cần làm — ví dụ "Học thuộc bảng nhân 7. Làm bài 1, 2 trang 46 vào vở ô li."
   Phụ huynh và các con đọc đúng những dòng này.
3. **Hạn hoàn thành** (không bắt buộc).
4. Bấm **Giao cho cả lớp** (hoặc **Lưu nháp** để giao sau).

Mỗi nhiệm vụ là **một tờ giấy note ghim đinh** đặt thẳng, như trên Padlet, mỗi tờ một màu pastel tự đổi; gia đình cũng thấy y như vậy. Tờ nào cũng cùng một cỡ vuông: nhiệm vụ dài thì hiện đến dấu **…**, **bấm vào tờ note** là đọc được đầy đủ.
Ghi nhầm thì bấm biểu tượng bút chì ở góc ô để sửa — gia đình mở ứng dụng là thấy bản mới ngay. Bấm thùng rác để xoá nhiệm vụ.

Bên nhà con, việc cô giao hiện ngay ở **Trang chủ** và trong mục **Nhiệm vụ**, chia làm **Cần làm** và **Đã qua**.

## 11. Báo cáo

Mục **Báo cáo**: chọn **Tuần**, **Tháng**, **Học kỳ** hoặc **Năm học**, dùng mũi tên để xem tuần trước, tháng trước.

- Điểm được cộng và bị trừ theo từng ngày (tuần), từng tuần (tháng), từng tháng (học kỳ, năm học).
- Điểm theo nhóm Học tập, Rèn luyện, Yêu thương và các lý do nhiều nhất.
- Số nhiệm vụ cô đã giao.
- Bảng từng học sinh, bấm tiêu đề cột để sắp xếp. **Tải file Excel (CSV)** hoặc **In báo cáo**.

Ngày học kỳ đặt trong **Cài đặt** (mặc định học kỳ I từ 5/9 đến 17/1, học kỳ II từ 18/1 đến 31/5).

Bấm tên một học sinh trong mục **Tài khoản học sinh** để xem **hồ sơ** của con: cây của con, giọt nước, huy hiệu, báo cáo riêng, và ô viết
**nhận xét của cô** (gia đình đọc được trong mục Kết quả).

## 12. Sơ đồ lớp, đổi thưởng, huy hiệu, gọi ngẫu nhiên

- **Sơ đồ lớp**: bấm **Sửa tổ** để đặt tên tổ, linh vật, tổ trưởng, tổ phó và **sửa thành viên của tổ**: chạm
  vào tên một bạn đang ở tổ khác là bạn ấy chuyển sang tổ này, bấm **Lưu** một lần cho tất cả. Bạn nào cũng phải ở
  trong một tổ, nên muốn đưa một bạn ra thì cô mở tổ mới của bạn ấy rồi chọn tên bạn. Xem tổng giọt nước và trung bình
  mỗi bạn của từng tổ.
  **Bảng thi đua các tổ** xếp hạng theo **tuần, tháng, học kỳ hoặc cả năm học**. Sơ
  đồ lớp: bấm vào chỗ ngồi để xếp một bạn (chọn bạn đang ngồi chỗ khác thì hai bạn đổi chỗ), hoặc **Xếp theo tổ**,
  **Xếp ngẫu nhiên**. Nhớ bấm **Lưu sơ đồ**.
- **Đổi thưởng**: việc này **chỉ cô làm**, ngay trước mặt con. Bấm **Trao quà**, chọn bạn và phần quà, giọt nước được
  trừ ngay. **Cây của con không nhỏ lại** — con chỉ cần cố gắng thêm để cây lớn tiếp. Bấm vào một phần quà để sửa tên
  hoặc số giọt nước cần đổi; **Thêm phần quà** để thêm phần mới. Trang của phụ huynh và học sinh không có mục đổi quà.
- **Huy hiệu** (tab nhỏ trong **Thi đua**): 8 huy hiệu ứng dụng tự trao khi con đạt mốc giọt nước và việc tốt (✨), 11 huy hiệu cô trao khi muốn
  khen (Mọt sách nhí, Người bạn tốt, Tiến bộ vượt bậc, Nhà toán học nhí…).
- **Gọi ngẫu nhiên** (ở Trang chủ): 4 cách gọi tên, gọi xong bấm **+1 💧** cho bạn ngay.
  - 🎲 **Gọi nhanh** – tên các bạn chạy qua rồi dừng lại một bạn.
  - 🎡 **Vòng quay may mắn** – quay 3–4 vòng, chậm dần rồi dừng đúng tên bạn. Tích **Bỏ bạn đã trúng ra khỏi vòng
    quay** để gọi hết lượt cả lớp.
  - 🎩 **Chiếc mũ bí mật** – bấm **Gõ mũ**: bàn tay đeo găng cầm **gậy ảo thuật** làm phép vào chiếc mũ 3–5 giây, rồi
    **bụp** — khói và sao bay lên, tên một bạn hiện ra. Mỗi bạn được gọi một lần trước khi vòng mới bắt đầu.
  - 🦆 **Đua vịt** – **cả lớp cùng đua** trên một mặt hồ rộng (không chia làn), các chú vịt chen chúc nhau, mỗi bạn một
    chú vịt có tên, nhiều màu khác nhau. Đường đua khoảng 5 giây, có bạn vượt lên, có bạn tụt lại.
  - Với vòng quay, chiếc mũ và đua vịt: hiệu ứng vừa xong là **một cửa sổ hiện giữa màn hình** với ảnh và tên bạn được
    chọn, nút **+1 💧** và **Đóng**.
- **Chia nhóm** (ở Trang chủ): chia lớp thành 2–8 nhóm ngẫu nhiên cho một hoạt động. Không ảnh hưởng tới tổ của lớp.

## 13. Lời nhắn (liên lạc với phụ huynh)

Mục **💌 Lời nhắn** — mục cuối của thanh công cụ — là nơi cô liên lạc với phụ huynh, và **tin nhắn phụ huynh
gửi cô cũng hiện ở đây**.

- **Tin nhắn**: mỗi gia đình một cuộc trò chuyện với cô. Tin chưa đọc hiện số đỏ ngay trên nút **Lời nhắn**. Muốn
  nhắn trước cho một gia đình thì chọn tên con ở danh sách **Nhắn cho gia đình khác** bên dưới.
- Có gia đình nhắn thì **Trang chủ của lớp** hiện ngay ô **💌 … lời nhắn mới của phụ huynh** — bấm vào là mở thẳng
  cuộc trò chuyện.
- **Thông báo cho cả lớp**: họp phụ huynh, lịch nghỉ, việc cần chuẩn bị. **Ghim lên đầu** thông báo quan trọng.

## 14. Khi con quên mật khẩu

Trước hết cô xem lại giúp gia đình: **Hồ sơ Măng non → Tài khoản học sinh** → **Hiện mật khẩu**, rồi bấm 📋 để sao
chép và gửi qua Zalo.

Muốn đổi hẳn: biểu tượng chìa khoá cạnh tên con → **Đặt lại mật khẩu**. Tài khoản về lại **Abc12345**, mật khẩu cũ
hết dùng được, các máy đang đăng nhập bị đăng xuất, và lần vào tới gia đình đặt mật khẩu riêng mới.

Nhập sai 8 lần liền, tài khoản tạm khoá 10 phút; cô đặt lại mật khẩu là mở khoá ngay.

## 15. Cài đặt

Mở bằng menu **tên cô** ở góc trên bên phải → **⚙️ Cài đặt lớp**. Tên lớp, khẩu hiệu, số tổ, ngày học kỳ, cho hay không cho phụ huynh xem Top 10 tuần, độ tối của dải chữ trên ảnh bìa.
(Tiêu chí cộng/trừ điểm đã chuyển sang **Đổi thưởng → Điểm cộng / Điểm trừ**.) Cuối trang có **Xoá lớp** (xoá hẳn, không khôi phục được).

---

## Câu hỏi thường gặp

**Phụ huynh có thấy điểm của con nhà khác không?** Không. Mỗi gia đình chỉ thấy của con mình. Riêng Top 10 tuần
thì cả lớp thấy, cô tắt được trong Cài đặt.

**Mất điện thoại hay đổi máy có mất dữ liệu không?** Không. Dữ liệu lưu trên máy chủ, đăng nhập máy khác là thấy đủ.

**Đổi ảnh đại diện của con thế nào?** Mục **Học sinh** → biểu tượng bút chì cạnh tên con → **Tải ảnh của con** (hoặc
**Đổi ảnh khác** nếu con đã có ảnh). Muốn bỏ ảnh thì bấm **Bỏ ảnh, dùng sticker**, hoặc chọn thẳng một sticker — ảnh
cũ bị xoá ngay, cả lớp không thấy nữa. Gia đình cũng đổi được trong mục **Tài khoản của con**.

**Dùng có tốn tiền không?** Trang web, cơ sở dữ liệu và GitHub đều miễn phí. Chỉ tốn tên miền (nếu cô mua) và gói Claude cô dùng để sửa ứng dụng.

**Có cài ứng dụng không?** Không cần. Trên điện thoại, mở trang web rồi chọn **Thêm vào màn hình chính** để có biểu
tượng như một ứng dụng.
