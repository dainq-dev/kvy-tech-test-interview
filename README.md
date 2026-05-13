# Document Verification Workflow

## Đã làm được gì

Hoạt động đầy đủ:
- Đăng nhập JWT — seller và admin đăng nhập riêng, token gắn role
- Seller upload document — validate loại file (PDF/JPG/PNG) và kích thước (tối đa 10MB), lưu vào DB với trạng thái `pending`
- Async verification pipeline — BullMQ worker nhận job, gọi mock service, mock service trả kết quả về qua webhook sau 3–8 giây
- State machine — các transition `pending → processing → approved/rejected/under_review` đều chạy trong DB transaction, ghi audit log cùng lúc
- Admin queue — xem danh sách document, lọc theo trạng thái, mỗi tab hiện số lượng
- Admin review — admin mở trang document thì tự động claim, ngăn 2 người review cùng lúc, approve hoặc reject kèm lý do tùy chọn
- Seller dashboard — tự refresh mỗi 5 giây, hiện đầy đủ trạng thái và lịch sử
- Audit history — toàn bộ lịch sử của document: ai làm gì, lúc nào, kết quả gì

Làm được một phần:
- Thông báo cho seller — hiện chỉ log ra console và ghi vào audit_logs, chưa gửi email thật. Interface đã chuẩn bị sẵn để gắn vào sau.
- Xem file — serve qua `/uploads/:filename`, chưa dùng signed URL. Ổn cho local dev, production thì đổi sang S3.

Chưa làm:
- Seller upload lại sau khi bị reject
- Tự động nhả lock khi admin bỏ dở trang review quá 10 phút
- Email thật qua SMTP/SES

---

## Nếu có thêm 2 tiếng

1. Tự động nhả lock — cron job kiểm tra `review_claimed_at`, nếu quá 10 phút mà chưa quyết định thì reset `current_reviewer_id = NULL`. Tránh document bị kẹt mãi.
2. Gửi email thật — cắm `nodemailer` vào NotificationService. Queue và audit hook đã có sẵn rồi, chỉ cần viết thêm adapter.
3. Cho phép upload lại — sau khi bị reject, seller upload document mới, document mới link tới document cũ qua `previous_document_id`.
4. E2E test — test chạy qua toàn bộ luồng: đăng nhập → upload → nhận webhook → kiểm tra trạng thái.

---

## Cách chạy

Yêu cầu: Bun, Docker

### Setup lần đầu

```bash
cd middle-resolver/project
./setup.sh
```

Script `setup.sh` tự động:
1. Tạo file `.env` từ `.env.example`
2. Khởi động PostgreSQL và Redis qua Docker
3. Cài dependencies cho backend và frontend
4. Chạy migration và seed dữ liệu mẫu

### Chạy dev

```bash
# Terminal 1 — backend
cd project/backend && bun dev

# Terminal 2 — frontend
cd project/frontend && bun dev
```

Frontend: http://localhost:3000  
Backend API: http://localhost:4000

### Tài khoản test

| Role   | Email               | Password  |
|--------|---------------------|-----------|
| Admin  | admin@kvy.io        | admin123  |
| Seller | seller@example.com  | seller123 |
| Seller | seller2@example.com | seller123 |

### Demo flow nhanh

1. Đăng nhập bằng `seller@example.com`
2. Upload 1 file PDF hoặc ảnh
3. Trạng thái chuyển `pending → processing` sau vài giây
4. Sau 3–8 giây sẽ ra một trong ba kết quả:
   - `approved` hoặc `rejected` — xong, không cần làm gì thêm
   - `under_review` — cần admin xử lý
5. Nếu `under_review`: đăng nhập bằng `admin@kvy.io`, vào Admin Dashboard
6. Bấm Review — trang tự động claim document, hiện nút Approve/Reject ngay
7. Quay lại tài khoản seller — trạng thái đã cập nhật

### Chạy test

```bash
cd project/backend && bun test
```
