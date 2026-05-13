'use client';
import { DocumentDetail } from '@/lib/interface';
import { useSellerDetailLogic } from './logic';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  approved: '#10b981',
  rejected: '#ef4444',
  under_review: '#8b5cf6',
  failed: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  approved: 'Approved',
  rejected: 'Rejected',
  under_review: 'Under Review — awaiting admin review',
  failed: 'Failed',
};

function Timeline({ history }: { history: DocumentDetail['history'] }) {
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
            <div style={styles.meta}>{new Date(entry.created_at).toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SellerDetailPage() {
  const { doc, handleBack } = useSellerDetailLogic();

  if (!doc) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  const status = doc.status;
  const color = STATUS_COLORS[status] || '#888';

  return (
    <div style={styles.container}>
      <button onClick={handleBack} style={styles.backBtn}>← Back to dashboard</button>

      <div style={styles.card}>
        <h1 style={styles.title}>{doc.file_name}</h1>
        <div style={styles.grid}>
          <div>
            <span style={styles.label}>Status</span>
            <div style={{ marginTop: 6 }}>
              <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: color + '20', color }}>
                {STATUS_LABELS[status] || status}
              </span>
            </div>
          </div>
          <div>
            <span style={styles.label}>File size</span>
            <p style={styles.value}>{(doc.file_size_bytes / 1024).toFixed(1)} KB</p>
          </div>
          <div>
            <span style={styles.label}>Submitted</span>
            <p style={styles.value}>{new Date(doc.submitted_at).toLocaleString()}</p>
          </div>
          {doc.decided_at && (
            <div>
              <span style={styles.label}>Decided</span>
              <p style={styles.value}>{new Date(doc.decided_at).toLocaleString()}</p>
            </div>
          )}
          {doc.decision_reason && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={styles.label}>Reason</span>
              <p style={styles.value}>{doc.decision_reason}</p>
            </div>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>History</h2>
        {doc.history.length === 0 ? (
          <p style={{ color: '#999', fontSize: 14 }}>No history yet.</p>
        ) : (
          <Timeline history={doc.history} />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1280, margin: '0 auto', padding: '32px 16px' },
  backBtn: { background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 14, marginBottom: 16, padding: 0 },
  card: { background: '#fff', borderRadius: 8, padding: 24, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
  title: { margin: '0 0 20px', fontSize: 18, fontWeight: 700, wordBreak: 'break-all' } as React.CSSProperties,
  sectionTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label: { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 } as React.CSSProperties,
  value: { margin: '4px 0 0', fontSize: 14, color: '#333' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 14 },
  timelineItem: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, background: '#3b82f6', marginTop: 5, flexShrink: 0 },
  action: { fontSize: 14, fontWeight: 600, textTransform: 'capitalize' } as React.CSSProperties,
  transition: { fontSize: 13, color: '#666' },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
};
