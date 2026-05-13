'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, Document } from '@/lib/api';

export function useSellerLogic() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [name, setName] = useState('');

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await api.getMyDocuments();
      setDocuments(docs);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    setName(localStorage.getItem('name') || 'Seller');
    loadDocuments();
    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, [loadDocuments]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadSuccess('');
    setUploading(true);
    try {
      await api.uploadDocument(file);
      setUploadSuccess('Document uploaded successfully. Verification in progress.');
      await loadDocuments();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleLogout() {
    localStorage.clear();
    router.replace('/login');
  }

  return { name, documents, uploading, uploadError, uploadSuccess, handleUpload, handleLogout };
}
