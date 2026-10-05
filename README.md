# KPOS Mobile V7

KPOS Mobile là **1 app duy nhất** cho bán hàng và quản lý khách hàng, tối ưu điện thoại với giao diện **CAM – TRẮNG**.

## Chức năng chính

- Tổng quan doanh thu, lợi nhuận, đơn hàng, công nợ, tiền mặt, chuyển khoản, IMEI tồn.
- POS bán hàng: tìm/quét barcode, chọn khách, giỏ hàng, giảm giá, phụ thu, tiền khách trả, công nợ.
- Sản phẩm có IMEI/Serial hiển thị rõ ngay trên màn hình bán hàng.
- Quản lý sản phẩm, ảnh, SKU, barcode, tồn kho, bảo hành.
- Nhập hàng và quét barcode liên tục.
- Quét IMEI/Serial liên tục, chống trùng.
- IMEI liên kết nhập kho → bán hàng → hóa đơn → khách hàng → bảo hành.
- CRM trong cùng app: tình trạng khách, nhu cầu, ngân sách, lịch care, Hôm nay, Quá hạn, lịch sử chăm sóc.
- Bảo hành tra cứu bằng IMEI/Serial.
- Công nợ và thu tiền bằng tiền mặt/chuyển khoản.
- Mẫu in K80/A4 cho hóa đơn và phiếu bảo hành, có review khi chỉnh.
- Backup/khôi phục dữ liệu JSON.

## Bổ sung trong V7

- Cài đặt thông tin cửa hàng/công ty để dùng trên mẫu in.
- Chọn K80/A4 mặc định cho hóa đơn và phiếu bảo hành.
- Ngày giờ bán có thể điều chỉnh ngay lúc thanh toán.
- Hủy hóa đơn an toàn: hoàn tồn kho, hoàn IMEI về kho, điều chỉnh công nợ/doanh thu và đánh dấu thanh toán liên quan đã hủy.
- Lưu lý do + thời điểm hủy hóa đơn.
- Xóa sản phẩm chỉ khi chưa có lịch sử hóa đơn.
- Dashboard và báo cáo tự loại hóa đơn/thanh toán đã hủy.

## Tài khoản test

- Tài khoản: `admin`
- Mật khẩu: `123456`

## Link ứng dụng

`https://trongkhasmartpos-ship-it.github.io/kpos-mobile/`

## Dữ liệu hiện tại

V7 vẫn dùng `localStorage` trên từng thiết bị. Dữ liệu chưa tự đồng bộ giữa nhiều điện thoại.

Bước production tiếp theo là kết nối database online để đăng nhập thật, đồng bộ nhiều thiết bị, lưu ảnh cloud và phân quyền nhân viên.
