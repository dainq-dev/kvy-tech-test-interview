'use client';
import { AdminDocumentDetail } from '@/lib/interface';
import { useReviewLogic } from './logic';

function AuditTimeline({ history }: { history: AdminDocumentDetail['history'] }) {
  return (
    <div style={styles.timeline}>
      {history.map((entry, i) => (
        <div key={i} style={styles.timelineItem}>
          <div style={styles.dot} />
          <div>
            <span style={styles.action}>{entry.action.replace(/_/g, ' ')}</span>
            {entry.from_status && entry.to_status && (
              <span style={styles.transition}> {entry.from_status} → {entry.to_status}</span>
            )}
            <div style={styles.meta}>
              {entry.actor_name ? `by ${entry.actor_name}` : 'by system'} · {new Date(entry.created_at).toLocaleString()}
            </div>
            {!!entry.metadata?.reason && (
              <div style={styles.meta}>Reason: {String(entry.metadata.reason)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DecisionPanel({ canDecide, claimError, reason, setReason, submitting, error, onDecide }: {
  canDecide: boolean;
  claimError: string;
  reason: string;
  setReason: (v: string) => void;
  submitting: boolean;
  error: string;
  onDecide: (d: 'approved' | 'rejected') => void;
}) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Make a Decision</h2>
      {claimError ? (
        <p style={{ color: '#f59e0b', fontSize: 14 }}>{claimError}</p>
      ) : canDecide ? (
        <div>
          <label style={styles.label}>Reason (optional)</label>
          <textarea
            style={styles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Add a reason for your decision..."
            maxLength={500}
            rows={3}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button style={{ ...styles.decideBtn, background: '#10b981' }} onClick={() => onDecide('approved')} disabled={submitting}>
              Approve
            </button>
            <button style={{ ...styles.decideBtn, background: '#ef4444' }} onClick={() => onDecide('rejected')} disabled={submitting}>
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: '#999', fontSize: 14 }}>Claiming document...</p>
      )}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

export default function ReviewPage() {
  const { doc, reason, setReason, submitting, error, claimError, canDecide, handleDecide, handleBack } = useReviewLogic();

  if (!doc) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  return (
    <div style={styles.container}>
      <button onClick={handleBack} style={styles.backBtn}>← Back to queue</button>

      <div style={styles.card}>
        <h1 style={styles.title}>Review Document</h1>
        <div style={styles.grid}>
          <div><span style={styles.label}>Seller</span><p style={styles.value}>{doc.seller_name} ({doc.seller_email})</p></div>
          <div><span style={styles.label}>File</span><p style={styles.value}>{doc.file_name}</p></div>
          <div><span style={styles.label}>Status</span><p style={styles.value}>{doc.status.replace('_', ' ')}</p></div>
          <div><span style={styles.label}>Submitted</span><p style={styles.value}>{new Date(doc.submitted_at).toLocaleString()}</p></div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'end', gap: 20 }}>
          <span style={styles.label}>Document Preview</span>
          <a href={`${apiBase}${doc?.file_url}`} target="_blank" rel="noopener noreferrer" style={styles.previewLink}>
            Open document in new tab
          </a>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Audit History</h2>
        <AuditTimeline history={doc.history} />
      </div>

      {doc.status === 'under_review' && (
        <DecisionPanel
          canDecide={canDecide}
          claimError={claimError}
          reason={reason}
          setReason={setReason}
          submitting={submitting}
          error={error}
          onDecide={handleDecide}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1280, margin: '0 auto', padding: '32px 16px' },
  backBtn: { background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 14, marginBottom: 16, padding: 0 },
  card: { background: '#fff', borderRadius: 8, padding: 24, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
  title: { margin: '0 0 20px', fontSize: 20, fontWeight: 700 },
  sectionTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 } as React.CSSProperties,
  value: { margin: '4px 0 0', fontSize: 14, color: '#333' },
  previewLink: { display: 'inline-block', marginTop: 6, color: '#3b82f6', fontSize: 14, textDecoration: 'underline' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 14 },
  timelineItem: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, background: '#3b82f6', marginTop: 5, flexShrink: 0 },
  action: { fontSize: 14, fontWeight: 600, textTransform: 'capitalize' } as React.CSSProperties,
  transition: { fontSize: 13, color: '#666' },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' } as React.CSSProperties,
  claimBtn: { padding: '8px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  decideBtn: { padding: '8px 24px', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  error: { color: '#e53e3e', marginTop: 12, fontSize: 13 },
};
