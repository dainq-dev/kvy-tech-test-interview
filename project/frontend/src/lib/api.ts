import { AdminDocument, AdminDocumentDetail, DocumentDetail } from "./interface";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: { id: string; email: string; name: string; role: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  me: () => apiFetch<{ userId: string; email: string; role: string }>('/auth/me'),

  // Seller
  uploadDocument: (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('document', file);
    return fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json();
    });
  },

  getMyDocuments: () => apiFetch<Document[]>('/documents'),

  getDocument: (id: string) => apiFetch<DocumentDetail>(`/documents/${id}`),

  // Admin
  adminGetDocuments: (status?: string) =>
    apiFetch<AdminDocument[]>(`/admin/documents${status ? `?status=${status}` : ''}`),

  adminGetDocument: (id: string) => apiFetch<AdminDocumentDetail>(`/admin/documents/${id}`),

  adminClaimDocument: (id: string) =>
    apiFetch(`/admin/documents/${id}/claim`, { method: 'POST' }),

  adminDecide: (id: string, decision: 'approved' | 'rejected', reason?: string) =>
    apiFetch(`/admin/documents/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }),

  adminGetStats: () =>
    apiFetch<Record<string, number>>('/admin/stats'),

  adminRetry: (id: string) =>
    apiFetch(`/admin/documents/${id}/retry`, { method: 'POST' }),
};
