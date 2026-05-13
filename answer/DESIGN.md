# DESIGN.md — Document Verification Workflow

## 1. Overview

Nhìn qua thì đây chỉ là feature upload document rồi verify. Nhưng thực ra cái platform đang cần là một quy trình: seller chưa verify thì không được bán hàng. Không có cái này thì ai cũng có thể đăng ký, tạo shop, bán hàng giả — và đến khi có vấn đề thì platform không có gì để chứng minh là mình đã kiểm tra.

Cái khó không phải là luồng happy path (upload → verified → done), mà là xử lý những trường hợp không rõ ràng: service verify tự động trả về `inconclusive` cho khoảng ~33% document. Lúc đó phải có người xem, phải track ai xem, xem lúc nào, quyết định gì — mà không để 2 admin cùng review 1 document, không để document bị kẹt không ai biết.

Nói gọn lại thì đây là bài toán async workflow có human-in-the-loop, cần audit trail đầy đủ.

### Các bên liên quan

Seller muốn biết document của mình đang ở đâu trong quá trình. Không cần fancy, chỉ cần không phải ngồi chờ mà không biết gì.

Admin không muốn phải review tất cả document — chỉ những cái thực sự cần người xem. Và khi xem thì muốn có đủ context để quyết định ngay, không phải đi hỏi thêm.

Platform cần đảm bảo chỉ verified seller mới bán được hàng, và mọi quyết định đều trace được — phòng khi có khiếu nại.

### Không làm gì trong lần này

- Seller upload lại sau khi bị reject (cần thêm product decision)
- Yêu cầu nhiều loại document
- KYC / xác minh danh tính cá nhân
- Phân quyền admin

---

## 2. Câu hỏi cần hỏi trước khi làm

Một số chỗ trong brief để mở, ảnh hưởng trực tiếp đến thiết kế nên cần làm rõ trước.

# Về product behavior

Sau khi bị reject, seller có upload lại được không? Câu này quyết định `REJECTED` là terminal state hay không — nếu được upload lại thì state machine phức tạp hơn hẳn. Tương tự, admin có thể đảo ngược quyết định không? Nếu có thì "terminal" chỉ là tên gọi, không phải thật sự terminal.

Giả định tạm: cả `APPROVED` và `REJECTED` đều terminal. Upload lại sau reject là feature riêng, handle ở version sau.

Admin có SLA review không — kiểu "phải xử lý trong 4 tiếng"? Nếu có thì cần thêm reminder, escalation. Không có thì queue cứ hiển thị cũ nhất lên đầu là đủ.

Giả định tạm: không có SLA.

# Về tích hợp dịch vụ verify

Service nhận file hay URL? Webhook hay polling? Hai câu này quyết định kiến trúc tích hợp. Webhook thì sạch hơn — worker gọi xong là xong, kết quả về reactive. Polling thì worker phải ngồi chờ hoặc schedule job check lại.

Giả định tạm: service nhận URL, trả kết quả qua webhook.

# Về file và storage

Chấp nhận loại file nào, giới hạn size bao nhiêu? Document có phải data nhạy cảm, lưu bao lâu? Ảnh hưởng đến validate, storage policy, access log.

Giả định tạm: PDF và ảnh, tối đa 10MB, lưu local trong scope demo này.

# Về notification

"Thông báo cho seller" là email, in-app, hay cả hai? Email cần SMTP, template, retry riêng — thực ra là sub-feature độc lập.

Giả định tạm: in-app (seller vào dashboard là thấy). Email là bước plug in sau.

---

## 3. Kiến trúc

```
┌────────────────────────────────────────────────┐
│              Next.js Frontend                  │
│   /seller              /admin                  │
│   upload + xem status  queue + review          │
└──────────┬─────────────────────┬───────────────┘
           │ JWT                 │ JWT
           ▼                     ▼
┌────────────────────────────────────────────────┐
│           Bun + Hono Backend                   │
│                                                │
│  /auth   /documents   /admin   /webhook        │
│                  │                             │
│                  │ enqueue                     │
│                  ▼                             │
│       BullMQ (verification-queue)              │
│       BullMQ (notification-queue)              │
│                                                │
│  /mock/verify  ← giả lập external service      │
└──────────────┬─────────────────────────────────┘
               │
        ┌──────┴───────┐    ┌─────────┐
        │  PostgreSQL  │    │  Redis  │
        │  users       │    │  BullMQ │
        │  documents   │    └─────────┘
        │  audit_logs  │
        └──────────────┘
```

VerificationWorker nhận job từ queue, gọi `/mock/verify`, chuyển document sang `processing`. Kết quả về qua webhook.

NotificationWorker chạy sau khi document đến terminal state, ghi audit log (và sau này gửi email).

`/mock/verify` nhận request, trả về ngay, sau đó delay ngẫu nhiên rồi POST kết quả về `/webhook/verification-result`. Mô phỏng đúng cách real-world third-party API hoạt động.

Audit log là append-only — không bao giờ UPDATE, mỗi state change là 1 row mới.

### Data model

```sql
users         — id, email, password_hash, name, role (seller | admin)

documents     — id, seller_id, file_url, file_name, file_size_bytes
                status (pending | processing | approved | rejected | under_review | failed)
                external_ref_id        -- ID từ mock service
                current_reviewer_id    -- optimistic lock
                review_claimed_at
                submitted_at, decided_at, decision_reason

audit_logs    — document_id, actor_id (NULL = system), action,
                from_status, to_status, metadata (JSONB), created_at
```

### State machine

```
           PENDING
              │
              │ worker nhận job
              ▼
          PROCESSING
         /     |      \
    verified  rejected  inconclusive
       │         │           │
       ▼         ▼           ▼
   APPROVED  REJECTED   UNDER_REVIEW
  (terminal) (terminal)      │
                        admin quyết định
                        /           \
                   APPROVED       REJECTED
                  (terminal)     (terminal)

  PROCESSING → (fail 5 lần) → FAILED (terminal)
```

---

## 4. Stack

Bun + Hono cho backend. Bun chạy TypeScript thẳng, không cần build step, dev loop nhanh hơn hẳn. Hono nhẹ, middleware đơn giản, không có magic. Trước đây dùng Express nhưng với Bun thì Hono hợp hơn.

Next.js cho frontend. Một app cho cả seller và admin, phân qua role-based routing. Không cần setup 2 project riêng.

PostgreSQL vì cần transaction thật sự — mỗi state transition phải atomic với audit log. SQLite không đủ an toàn khi có concurrent writes. Ngoài ra enum type của Postgres khớp đúng với state machine.

BullMQ + Redis cho job queue. Verification job có thể chạy vài giây đến vài giờ — cần persist qua server restart. BullMQ có retry + backoff + stalled job detection built-in. Từng cân nhắc `pg-boss` (jobs trong Postgres, không cần Redis) nhưng BullMQ tooling tốt hơn và đã quen.

Mock service là 1 route trong backend thay vì service riêng. Không có lý do gì để tách ra trong scope này — chỉ thêm phức tạp khi dev local.

---

## 5. Những quyết định quan trọng

### Webhook thay vì polling

Mock service POST kết quả về backend sau khi xong, thay vì worker ngồi poll mỗi N giây. Polling thì dễ code hơn nhưng tốn query liên tục và cần lưu trạng thái poll ở đâu đó. Webhook thì worker xong việc sau khi gọi service — phần còn lại là reactive. Cách này cũng giống cách Stripe, Twilio hoạt động nên nếu sau này thay mock bằng real service thì interface không cần đổi nhiều.

Nếu real service chỉ support polling thì thêm job type `poller` với `repeat` strategy trong BullMQ, max attempts tương ứng SLA.

### State transition atomic với audit log

Mỗi lần đổi trạng thái chạy trong 1 Postgres transaction: `UPDATE documents` và `INSERT INTO audit_logs` cùng lúc. Nếu tách ra làm 2 bước thì có thể có trường hợp state đổi nhưng log không có — tệ hơn là mất luôn state. Audit log là bằng chứng pháp lý nên không được phép có gap.

### Optimistic lock cho admin review

`current_reviewer_id` set khi admin claim document. Admin thứ 2 claim cùng document nhận `409`. Không dùng pessimistic lock (`SELECT FOR UPDATE` giữ nguyên session) vì admin có thể mở tab rồi đi uống cà phê — không thể block DB row mấy tiếng được. Lock tự release sau 10 phút qua cleanup job (chưa implement trong version này).

### BullMQ retry 5 lần với exponential backoff

1s → 2s → 4s → 8s → 16s. Sau đó document chuyển sang `failed`. 5 lần đủ để qua lỗi mạng ngắn hay service flaky. Nếu sau ~30 giây vẫn fail thì có thể là lỗi hệ thống cần người xem xét, không nên retry mãi.

Nếu SLA của service là "available trong 1 tiếng" thì đổi retry schedule thành mỗi 15 phút x 4 lần.

### Notification queue độc lập

Sau khi document đến terminal state, đẩy notification job vào queue riêng. Notification fail không rollback quyết định verify. Hai việc này độc lập nhau — seller không nhận được email là bad UX nhưng không làm sai kết quả verify. Ngược lại nếu gắn vào cùng transaction thì email SMTP down sẽ làm hỏng cả luồng verify.

---

## 6. Những thứ có thể sai

Mock service trả JSON sai format: Worker parse response trong try/catch. Nếu fail thì job throw, BullMQ retry. Nếu hết retry, document sang `failed`, raw response lưu vào `audit_logs.metadata`. Không crash process.

Mock service down vài tiếng: BullMQ retry với backoff. Hết retry thì `status = 'failed'`. Redis giữ job state qua server restart. Admin thấy document `failed` trong queue, có thể re-queue thủ công.

Seller upload file 50MB: Kiểm tra `file.size` ngay trong route handler trước khi làm gì. Trả `413` với message rõ. Không tạo DB record nào.

Hai admin review cùng document: Admin A claim → set `current_reviewer_id = adminA` trong transaction với `FOR UPDATE`. Admin B claim → đọc được `current_reviewer_id` đã có người, trả `409`. Frontend B redirect về queue.

Gửi notification thất bại: Queue riêng retry độc lập. Verification state đã commit. Seller vẫn thấy trạng thái đúng khi vào dashboard.

Server restart khi job đang chạy: BullMQ stalled job detection tự re-queue. Worker kiểm tra trạng thái document trước khi gọi service — nếu không còn ở `pending` thì bỏ qua (idempotent).

---

## 7. Những thứ tôi bỏ qua có chủ ý

Upload lại sau reject — cần product quyết định: bao nhiêu lần, có cooldown không, v.v. Nếu làm thì thêm transition `rejected → pending` với guard `canResubmit()`, document mới link `previous_document_id` về cái cũ.

Email notification — interface đã pluggable, chỉ cần viết thêm email adapter cho `NotificationService`. Bỏ vì setup SMTP/SES + template + bounce handling là sub-feature riêng, không thuộc core workflow.

Document expiry — chưa có yêu cầu cụ thể trong brief. Thêm sau bằng `expires_at` + cron job dọn dẹp. Rủi ro: document nhạy cảm lưu mãi.

Admin analytics — thêm sau bằng endpoint `/admin/stats` aggregate từ `audit_logs`. Rủi ro: ops không thấy được queue depth hay rejection rate.

---

## 8. Kế hoạch nếu có 2 tuần

| | Việc | Ước tính | Cần gì trước |
|---|---|---|---|
| 1 | DB schema + migration | 0.5 ngày | — |
| 2 | Auth (JWT, seed data) | 0.5 ngày | 1 |
| 3 | Upload endpoint | 1 ngày | 1, 2 |
| 4 | BullMQ + worker skeleton | 1 ngày | 1 |
| 5 | Mock service | 0.5 ngày | — |
| 6 | Webhook + state machine | 1 ngày | 4, 5 |
| 7 | Admin routes | 1 ngày | 6 |
| 8 | Notification | 0.5 ngày | 6 |
| 9 | Seller frontend | 1.5 ngày | 3, 2 |
| 10 | Admin frontend | 1.5 ngày | 7, 2 |
| 11 | Validation, error handling, tests | 1 ngày | tất cả |
| 12 | Deploy | 0.5 ngày | tất cả |
