'use client';
import Link from 'next/link';
import { useSellerLogic } from './logic';

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
  under_review: 'Under Review',
  failed: 'Failed',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 600,
      background: STATUS_COLORS[status] + '20',
      color: STATUS_COLORS[status],
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function SellerPage() {
  const { name, documents, uploading, uploadError, uploadSuccess, handleUpload, handleLogout } = useSellerLogic();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Seller Dashboard</h1>
          <p style={styles.subtitle}>Welcome, {name}</p>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Upload Verification Document</h2>
        <p style={styles.hint}>Accepted: PDF, JPG, PNG — max 10MB</p>
        <label style={styles.uploadLabel}>
          {uploading ? 'Uploading...' : 'Choose file to upload'}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        {uploadError && <p style={styles.error}>{uploadError}</p>}
        {uploadSuccess && <p style={styles.success}>{uploadSuccess}</p>}
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={styles.sectionTitle}>My Documents</h2>
          <span style={{ fontSize: 12, color: '#999' }}>Auto-refreshes every 5s</span>
        </div>
        {documents.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '24px 0' }}>No documents uploaded yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>File Name</th>
                <th style={styles.th}>Size</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Submitted</th>
                <th style={styles.th}>Decision</th>
                <th style={styles.th}>Reason</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={styles.td}>{doc.file_name}</td>
                  <td style={styles.td}>{(doc.file_size_bytes / 1024).toFixed(1)} KB</td>
                  <td style={styles.td}><StatusBadge status={doc.status} /></td>
                  <td style={styles.td}>{new Date(doc.submitted_at).toLocaleString()}</td>
                  <td style={styles.td}>{doc.decided_at ? new Date(doc.decided_at).toLocaleString() : '—'}</td>
                  <td style={styles.td}>{doc.decision_reason || '—'}</td>
                  <td style={styles.td}>
                    <Link href={`/seller/${doc.id}`} style={styles.viewLink}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1480, margin: '0 auto', padding: '32px 16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 700 },
  subtitle: { margin: '4px 0 0', color: '#666' },
  logoutBtn: { padding: '6px 14px', background: 'transparent', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  card: { background: '#fff', borderRadius: 8, padding: 24, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
  sectionTitle: { margin: '0 0 8px', fontSize: 16, fontWeight: 600 },
  hint: { margin: '0 0 12px', color: '#888', fontSize: 13 },
  uploadLabel: { display: 'inline-block', padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  error: { color: '#e53e3e', marginTop: 10, fontSize: 13 },
  success: { color: '#10b981', marginTop: 10, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #f0f0f0', fontWeight: 600, color: '#555', fontSize: 12 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f5f5f5', color: '#333' },
  viewLink: { padding: '4px 10px', background: '#f5f5f5', color: '#555', borderRadius: 6, fontSize: 12, fontWeight: 500, textDecoration: 'none' },
};
