'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AdminDocument } from '@/lib/interface';

export type FilterStatus = 'all' | 'pending' | 'processing' | 'under_review' | 'approved' | 'rejected' | 'failed';

export const ALL_FILTERS: FilterStatus[] = [
  'all','under_review', 'pending', 'processing', 'approved', 'rejected', 'failed',
];

export function useAdminLogic() {
  const router = useRouter();
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [name, setName] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const [docs, s] = await Promise.all([
        api.adminGetDocuments(filter === 'all' ? undefined : filter),
        api.adminGetStats(),
      ]);
      setDocuments(docs);
      setStats({ ...s, all: Object.values(s).reduce((a, b) => a + b, 0) });
    } catch {
      router.replace('/login');
    }
  }, [filter, router]);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') { router.replace('/login'); return; }
    setName(localStorage.getItem('name') || 'Admin');
  }, [router]);

  useEffect(() => {
    loadDocuments();
    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, [loadDocuments]);

  async function handleRetry(id: string) {
    setRetrying(id);
    try {
      await api.adminRetry(id);
      await loadDocuments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRetrying(null);
    }
  }

  function handleLogout() {
    localStorage.clear();
    router.replace('/login');
  }

  return { name, documents, stats, filter, setFilter, retrying, handleRetry, handleLogout };
}
