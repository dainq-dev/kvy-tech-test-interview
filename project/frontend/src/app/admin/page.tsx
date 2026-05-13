'use client';
import Link from 'next/link';
import { useAdminLogic, ALL_FILTERS, FilterStatus } from './logic';
import { AdminDocument } from '@/lib/interface';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  approved: '#10b981',
  rejected: '#ef4444',
  under_review: '#8b5cf6',
  failed: '#6b7280',
  all: '#888',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  approved: 'Approved',
  rejected: 'Rejected',
  under_review: 'Under Review',
  failed: 'Failed',
};

function StatsBar({ stats }: { stats: Record<string, number> }) {
  const order: (keyof typeof STATUS_COLORS)[] = ['under_review', 'pending', 'processing', 'failed', 'approved', 'rejected'];
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {order.map((s) => {
        const count = stats[s] ?? 0;
        if (count === 0) return null;
        return (
          <div key={s} style={{
            padding: '10px 16px', borderRadius: 8,
            background: STATUS_COLORS[s] + '15',
            border: `1px solid ${STATUS_COLORS[s]}40`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS[s] }}>{count}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{STATUS_LABELS[s]}</div>
          </div>
        );
      })}
    </div>
  );
}

function FilterBar({ filter, setFilter, total, stats }: {
  filter: FilterStatus;
  setFilter: (f: FilterStatus) => void;
  total: number;
  stats: Record<string, number>;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
      {ALL_FILTERS.map((s) => (
        <button
          key={s}
          onClick={() => setFilter(s)}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
            border: '1px solid ' + (filter === s ? '#3b82f6' : '#ddd'),
            background: filter === s ? '#eff6ff' : '#fff',
            color: filter === s ? '#3b82f6' : '#555',
            fontWeight: filter === s ? 600 : 400,
            minHeight: 40
          }}
        >
          {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          {stats[s] && (
            <span style={{ marginLeft: 8, background: STATUS_COLORS[s], color: '#fff', padding: '2px 7px', borderRadius: 12, fontSize: 11 }}>
              {stats[s]}
            </span>
          )}
        </button>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>
        {total} result(s) · auto-refreshes 5s
      </span>
    </div>
  );
}

function DocumentRow({ doc, retrying, onRetry }: {
  doc: AdminDocument;
  retrying: string | null;
  onRetry: (id: string) => void;
}) {
  const waitingHours = ((Date.now() - new Date(doc.submitted_at).getTime()) / 3600000).toFixed(1);

  return (
    <tr>
      <td style={styles.td}>
        <div style={{ fontWeight: 500 }}>{doc.seller_name}</div>
        <div style={{ color: '#888', fontSize: 12 }}>{doc.seller_email}</div>
      </td>
      <td style={styles.td}>{doc.file_name}</td>
      <td style={styles.td}>
        <span style={{
          display: 'inline-block', padding: '2px 10px', borderRadius: 12,
          fontSize: 12, fontWeight: 600,
          background: (STATUS_COLORS[doc.status] || '#888') + '20',
          color: STATUS_COLORS[doc.status] || '#888',
        }}>
          {STATUS_LABELS[doc.status] || doc.status}
        </span>
      </td>
      <td style={styles.td}>
        <div>{new Date(doc.submitted_at).toLocaleString()}</div>
        {(doc.status === 'under_review' || doc.status === 'pending' || doc.status === 'processing') && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>{waitingHours}h ago</div>
        )}
      </td>
      <td style={styles.td}>{doc.reviewer_name || '—'}</td>
      <td style={styles.td}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href={`/admin/review/${doc.id}`} style={styles.viewLink}>
            View
          </Link>
          {doc.status === 'under_review' && (
            <Link href={`/admin/review/${doc.id}`} style={styles.reviewLink}>
              Review
            </Link>
          )}
          {doc.status === 'failed' && (
            <button
              style={{ ...styles.retryBtn, opacity: retrying === doc.id ? 0.6 : 1 }}
              onClick={() => onRetry(doc.id)}
              disabled={retrying === doc.id}
            >
              {retrying === doc.id ? '...' : 'Retry'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const { name, documents, stats, filter, setFilter, retrying, handleRetry, handleLogout } = useAdminLogic();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.subtitle}>Welcome, {name}</p>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
      </div>

      {/* <StatsBar stats={stats} /> */}

      <div style={styles.card}>
        <FilterBar filter={filter} setFilter={setFilter} total={documents.length} stats={stats} />
        {documents.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '32px 0' }}>No documents in this category.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Seller</th>
                <th style={styles.th}>File</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Submitted</th>
                <th style={styles.th}>Reviewer</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} retrying={retrying} onRetry={handleRetry} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1280, margin: '0 auto', padding: '32px 16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 700 },
  subtitle: { margin: '4px 0 0', color: '#666' },
  logoutBtn: { padding: '6px 14px', background: 'transparent', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  card: { background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #f0f0f0', fontWeight: 600, color: '#555', fontSize: 12 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f5f5f5', color: '#333', verticalAlign: 'top' },
  viewLink: { padding: '4px 10px', background: '#f5f5f5', color: '#555', borderRadius: 6, fontSize: 12, fontWeight: 500, textDecoration: 'none' },
  reviewLink: { padding: '4px 10px', background: '#8b5cf6', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none' },
  retryBtn: { padding: '4px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};
