CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('seller', 'admin');

CREATE TYPE doc_status AS ENUM (
  'pending',
  'processing',
  'approved',
  'rejected',
  'under_review',
  'failed'
);

CREATE TYPE audit_action AS ENUM (
  'submitted',
  'sent_to_service',
  'auto_approved',
  'auto_rejected',
  'inconclusive',
  'review_claimed',
  'admin_approved',
  'admin_rejected',
  'notification_sent',
  'job_failed'
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          user_role NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id             UUID NOT NULL REFERENCES users(id),
  file_url              TEXT NOT NULL,
  file_name             TEXT NOT NULL,
  file_size_bytes       INT NOT NULL,
  status                doc_status NOT NULL DEFAULT 'pending',
  external_ref_id       TEXT,
  current_reviewer_id   UUID REFERENCES users(id),
  review_claimed_at     TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at            TIMESTAMPTZ,
  decision_reason       TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id),
  actor_id     UUID REFERENCES users(id),
  action       audit_action NOT NULL,
  from_status  doc_status,
  to_status    doc_status,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_seller_id ON documents(seller_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_document_id ON audit_logs(document_id);
