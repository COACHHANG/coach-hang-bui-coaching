# Cấu hình thanh toán SePay

## 1. Supabase

Tạo project Supabase, mở **SQL Editor** và chạy toàn bộ file `sql/orders.sql`.

Trong **Settings → API**, lấy:

- Project URL → `SUPABASE_URL`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

Không dùng `anon` key cho server. Không công khai `service_role` key.

## 2. Vercel Environment Variables

Thêm vào **Settings → Environment Variables** của project Vercel:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SEPAY_WEBHOOK_SECRET=
SEPAY_ACCOUNT_NUMBER=
SEPAY_BANK_CODE=MBBank
PAYMENT_PREFIX=CHB
GMAIL_USER=coach.hangbui@gmail.com
GMAIL_APP_PASSWORD=
OWNER_EMAIL=coach.hangbui@gmail.com
```

Sau khi cập nhật biến môi trường, redeploy project.

## 3. Webhook SePay

Tạo webhook trong SePay sau khi deploy:

```text
https://coach-hang-bui-coaching.vercel.app/api/sepay-webhook
```

Chọn **Tiền vào**, tài khoản MB Bank tương ứng, bộ lọc `CHB`, và bảo mật `HMAC-SHA256`.

Secret HMAC phải trùng với `SEPAY_WEBHOOK_SECRET` trên Vercel.

## 4. Kiểm thử

1. Tạo đơn tại `/book.html`.
2. Kiểm tra QR có đúng 499.000đ và mã `CHB-...`.
3. Dùng tính năng test webhook của SePay.
4. Kiểm tra trạng thái đổi sang `paid` và hai email được gửi.
