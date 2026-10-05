# KPOS Mobile V8

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
- Hủy hóa đơn hoàn tồn kho + IMEI và điều chỉnh công nợ.

## Bổ sung trong V8

- Chuẩn bị backend Supabase cho database online.
- Supabase Auth: đăng nhập bằng email + mật khẩu thật.
- Row Level Security theo workspace/người dùng.
- Một tài khoản có thể đăng nhập trên nhiều điện thoại.
- Đồng bộ state online giữa các thiết bị.
- Realtime nhận thay đổi từ điện thoại khác.
- Khi mất mạng vẫn lưu localStorage trên máy; có mạng lại sẽ đồng bộ.
- Màn hình Cài đặt hiển thị trạng thái cloud, workspace, revision và nút Đồng bộ ngay.
- Có luồng tạo tài khoản lần đầu.

## File backend

- `supabase/schema.sql`: bảng, trigger tạo workspace, RLS và Realtime.
- `supabase/config.js`: Project URL + anon/public key.
- `v8/patch.js`: Auth + cloud sync + realtime.

## Cấu hình Supabase

1. Tạo/chọn project Supabase.
2. Chạy toàn bộ `supabase/schema.sql` trong SQL Editor.
3. Lấy Project URL và anon/public key.
4. Điền vào `supabase/config.js`.
5. Không bao giờ đưa `service_role` key vào frontend.
6. Mở lại app GitHub Pages và tạo tài khoản bằng email/mật khẩu.

## Link ứng dụng

`https://trongkhasmartpos-ship-it.github.io/kpos-mobile/`

## Chế độ an toàn

Nếu `supabase/config.js` chưa có Project URL/anon key, app vẫn chạy ở chế độ offline để không chặn việc test. Khi cấu hình Supabase xong, app tự chuyển sang đăng nhập online.
