import { PoolClient } from 'pg';

type AuditAction =
  | 'submitted' | 'sent_to_service' | 'auto_approved' | 'auto_rejected'
  | 'inconclusive' | 'review_claimed' | 'admin_approved' | 'admin_rejected'
  | 'notification_sent' | 'job_failed';

type DocStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'under_review' | 'failed';

interface AuditEntry {
  documentId: string;
  actorId?: string | null;
  action: AuditAction;
  fromStatus?: DocStatus | null;
  toStatus?: DocStatus | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(client: PoolClient, entry: AuditEntry) {
  await client.query(
    `INSERT INTO audit_logs (document_id, actor_id, action, from_status, to_status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.documentId,
      entry.actorId ?? null,
      entry.action,
      entry.fromStatus ?? null,
      entry.toStatus ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ]
  );
}
