# KPOS Mobile V6

KPOS Mobile là **1 app duy nhất** cho bán hàng và quản lý khách hàng, tối ưu điện thoại với giao diện **CAM – TRẮNG**.

## Chức năng đã hoàn thiện trong V6

- Tổng quan doanh thu, lợi nhuận, đơn hàng, công nợ, tiền mặt, chuyển khoản, IMEI tồn.
- POS bán hàng: tìm/quét barcode, chọn khách, giỏ hàng, giảm giá, phụ thu, tiền khách trả, công nợ.
- Sản phẩm có IMEI/Serial được đánh dấu rõ ngay trên màn hình bán hàng.
- Quản lý sản phẩm: tên, SKU, barcode, từ khóa, giá vốn, giá bán, tồn kho, ảnh, bảo hành.
- Nhập hàng bằng quét barcode liên tục.
- Nhập/quét IMEI/Serial liên tục, tự nhận từng mã, cảnh báo mã trùng.
- IMEI liên kết vòng đời: nhập kho → bán hàng → hóa đơn → khách hàng → bảo hành.
- CRM trong cùng app: tình trạng khách, nhu cầu, ngân sách, lịch care, Hôm nay, Quá hạn, lịch sử chăm sóc, báo cáo CRM.
- Bảo hành: quét IMEI tự tra sản phẩm, khách hàng, hóa đơn và thời hạn bảo hành.
- Công nợ và thu tiền bằng tiền mặt/chuyển khoản.
- Lịch sử kho và lịch sử thanh toán.
- Mẫu in có review trực tiếp khi chỉnh.
- 4 mẫu mặc định: Hóa đơn K80, Hóa đơn A4, Phiếu bảo hành K80, Phiếu bảo hành A4.
- Xem trước/in từ hóa đơn và phiếu bảo hành.
- Xuất và khôi phục dữ liệu JSON.
- PWA cài lên màn hình điện thoại và chạy qua GitHub Pages.

## Tài khoản test

- Tài khoản: `admin`
- Mật khẩu: `123456`

## Link ứng dụng

Sau khi GitHub Pages deploy thành công:

`https://trongkhasmartpos-ship-it.github.io/kpos-mobile/`

## Dữ liệu hiện tại

V6 đang dùng `localStorage` trên thiết bị để test và sử dụng cá nhân. Dữ liệu trên các điện thoại chưa tự đồng bộ với nhau.

Bước production tiếp theo là kết nối database online (ví dụ Supabase/PostgreSQL) để đăng nhập thật, đồng bộ nhiều thiết bị, lưu ảnh cloud và phân quyền nhân viên.
