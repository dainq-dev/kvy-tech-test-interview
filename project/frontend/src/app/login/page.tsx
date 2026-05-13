'use client';
import { useLoginLogic } from './logic';

export default function LoginPage() {
  const { email, setEmail, password, setPassword, error, loading, handleSubmit } = useLoginLogic();

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Document Verification</h1>
        <p style={styles.subtitle}>Sign in to continue</p>
        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div style={styles.hint}>
          <p><strong>Demo credentials:</strong></p>
          <p>Seller: seller@example.com / seller123</p>
          <p>Admin: admin@kvy.io / admin123</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#fff', borderRadius: 8, padding: 40, width: 380, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' },
  title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700 },
  subtitle: { margin: '0 0 24px', color: '#666' },
  field: { marginBottom: 16 },
  label: { display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' },
  error: { color: '#e53e3e', fontSize: 13, marginBottom: 12 },
  button: { width: '100%', padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  hint: { marginTop: 24, padding: 12, background: '#f0f9ff', borderRadius: 6, fontSize: 12, color: '#555', lineHeight: 1.6 },
};
