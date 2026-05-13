# Diagrams — Document Verification Workflow

## 1. System Architecture

```mermaid
graph TB
    subgraph Frontend["Next.js Frontend"]
        S["Seller View (/seller)"]
        A["Admin View (/admin)"]
    end

    subgraph Backend["Bun + Hono Backend"]
        AUTH["POST /auth"]
        DOC["POST /documents"]
        ADM["GET /admin"]
        WH["POST /webhook"]
        MOCK["POST /mock/verify"]

        subgraph Queues["BullMQ"]
            VQ["verification-queue"]
            NQ["notification-queue"]
        end

        subgraph Workers["Workers"]
            VW["VerificationWorker"]
            NW["NotificationWorker"]
        end
    end

    subgraph Storage["Storage"]
        PG[("PostgreSQL\nusers\ndocuments\naudit_logs")]
        RD[("Redis\nBullMQ state")]
    end

    S -->|JWT| AUTH
    S -->|JWT| DOC
    A -->|JWT| AUTH
    A -->|JWT| ADM

    DOC -->|enqueue| VQ
    VQ --> VW
    VW -->|HTTP| MOCK
    MOCK -->|webhook callback| WH
    WH -->|enqueue| NQ
    NQ --> NW

    Backend --> PG
    Queues --> RD
```

---

## 2. State Machine — Document Verification

```mermaid
stateDiagram-v2
    [*] --> PENDING : Seller uploads document\n[guard: file valid, size ≤ 10MB, role=seller]

    PENDING --> PROCESSING : Worker picks up job\n[guard: job not already claimed, document still PENDING]

    PROCESSING --> APPROVED : External service → verified\n[guard: webhook signature valid, refId matches]
    PROCESSING --> REJECTED : External service → rejected\n[guard: webhook signature valid, refId matches]
    PROCESSING --> UNDER_REVIEW : External service → inconclusive\n[guard: webhook signature valid, refId matches]
    PROCESSING --> FAILED : All retries exhausted\n[guard: attempt >= 5, no success response]

    UNDER_REVIEW --> APPROVED : Admin approves\n[guard: role=admin, document claimed by this admin, not expired]
    UNDER_REVIEW --> REJECTED : Admin rejects\n[guard: role=admin, document claimed by this admin, not expired]

    APPROVED --> [*] : terminal
    REJECTED --> [*] : terminal
    FAILED --> [*] : terminal

    note right of UNDER_REVIEW
        Claim lock expires after 10 min.
        Second admin gets 409 if doc already claimed.
    end note

    note right of FAILED
        Raw response saved to audit_logs.metadata
        for manual investigation.
    end note
```

---

## 3. Sequence — Happy Path (Auto Verified)

```mermaid
sequenceDiagram
    actor Seller
    participant FE as Next.js Frontend
    participant BE as Hono Backend
    participant Q as BullMQ
    participant W as VerificationWorker
    participant M as Mock Service
    participant DB as PostgreSQL

    Seller->>FE: Upload document
    FE->>BE: POST /documents (multipart)
    BE->>DB: INSERT document (status=pending)
    BE->>Q: Enqueue verification job
    BE-->>FE: 201 { documentId }

    Q->>W: Dequeue job
    W->>DB: UPDATE status=processing
    W->>M: POST /mock/verify { fileUrl }
    M-->>W: 202 Accepted { refId }

    Note over M: Random delay (2s–10s)

    M->>BE: POST /webhook/verification-result { refId, result=verified }
    BE->>DB: UPDATE status=approved + INSERT audit_log (transaction)
    BE->>Q: Enqueue notification job

    Seller->>FE: Check status
    FE->>BE: GET /documents/:id
    BE-->>FE: { status: "approved" }
    FE-->>Seller: Document Approved ✓
```

---

## 4. Sequence — Inconclusive → Admin Review

```mermaid
sequenceDiagram
    actor Seller
    actor Admin
    participant BE as Hono Backend
    participant M as Mock Service
    participant DB as PostgreSQL

    M->>BE: POST /webhook { result=inconclusive }
    BE->>DB: UPDATE status=under_review + INSERT audit_log

    Admin->>BE: GET /admin/documents?status=under_review
    BE-->>Admin: List of pending reviews

    Admin->>BE: POST /admin/documents/:id/claim
    BE->>DB: SET current_reviewer_id=adminId (FOR UPDATE)
    BE-->>Admin: 200 Claimed

    Admin->>BE: POST /admin/documents/:id/decide { decision=approved, reason }
    BE->>DB: UPDATE status=approved + INSERT audit_log (transaction)
    BE-->>Admin: 200 OK

    BE-->>Seller: Notification: Document Approved
```

---

## 5. Data Model (ER Diagram)

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email
        string password_hash
        string name
        enum role "seller | admin"
        timestamp created_at
    }

    DOCUMENTS {
        uuid id PK
        uuid seller_id FK
        string file_url
        string file_name
        int file_size_bytes
        enum status "pending | processing | approved | rejected | under_review | failed"
        string external_ref_id
        uuid current_reviewer_id FK
        timestamp review_claimed_at
        timestamp submitted_at
        timestamp decided_at
        string decision_reason
    }

    AUDIT_LOGS {
        uuid id PK
        uuid document_id FK
        uuid actor_id FK
        string action
        enum from_status
        enum to_status
        jsonb metadata
        timestamp created_at
    }

    USERS ||--o{ DOCUMENTS : "uploads"
    USERS ||--o{ AUDIT_LOGS : "performs"
    DOCUMENTS ||--o{ AUDIT_LOGS : "has"
    USERS ||--o| DOCUMENTS : "reviews (current_reviewer)"
```
