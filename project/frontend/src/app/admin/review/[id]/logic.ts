'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AdminDocumentDetail } from '@/lib/interface';

export function useReviewLogic() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<AdminDocumentDetail | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [claimError, setClaimError] = useState('');

  useEffect(() => {
    api.adminGetDocument(id)
      .then(async (d) => {
        setDoc(d);
        // auto-claim khi vào trang nếu document đang under_review và chưa có ai claim
        if (d.status === 'under_review' && !d.current_reviewer_id) {
          try {
            await api.adminClaimDocument(id);
          } catch (err: any) {
            setClaimError(err.message);
          }
        }
      })
      .catch(() => router.replace('/admin'));
  }, [id, router]);

  const canDecide = doc?.status === 'under_review' && !claimError;

  async function handleDecide(decision: 'approved' | 'rejected') {
    setError('');
    setSubmitting(true);
    try {
      await api.adminDecide(id, decision, reason || undefined);
      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  function handleBack() {
    router.push('/admin');
  }

  return { doc, reason, setReason, submitting, error, claimError, canDecide, handleDecide, handleBack };
}
