# KPOS Print Agent LAN/WiFi

KPOS Print Agent cho phép KPOS Web gửi hóa đơn K80 trực tiếp tới máy in nhiệt trong cùng mạng LAN/WiFi qua RAW/ESC-POS TCP (mặc định port 9100), không cần dịch vụ trả phí hàng tháng.

## Windows
1. Đặt 3 file `KPOS-Print-Agent.ps1`, `START-KPOS-PRINT-AGENT.bat`, `INSTALL-AUTOSTART.bat` cùng một thư mục.
2. Chạy `START-KPOS-PRINT-AGENT.bat` để thử. Giữ cửa sổ mở.
3. Hoặc chạy `INSTALL-AUTOSTART.bat` một lần để Agent tự chạy ẩn khi đăng nhập Windows.
4. Trong KPOS > Cài đặt > Máy in & mẫu in > KPOS Print Agent:
   - Bật Print Agent
   - Nhập IP máy in, ví dụ `192.168.1.100`
   - Port `9100`
   - Bấm `TEST AGENT` -> `TEST MÁY IN` -> `IN THỬ`
5. Khi thành công, bật `Tự in sau khi thanh toán` hoặc dùng nút `THANH TOÁN & IN LAN/WIFI`.

## Điều kiện máy in
- Máy tính và máy in cùng LAN/WiFi.
- Máy in có IP cố định hoặc DHCP reservation.
- Máy in hỗ trợ RAW/ESC-POS qua TCP. Port phổ biến là 9100.
- K80 80mm được hỗ trợ ở V1. A4 vẫn dùng driver/hộp thoại in hệ thống.

## Bảo mật
Agent chỉ lắng nghe trên `127.0.0.1`, không mở cổng ra mạng LAN. KPOS Web chỉ gửi lệnh tới Agent chạy trên chính máy tính đó; Agent mới kết nối tới IP máy in.
