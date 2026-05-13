'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { DocumentDetail } from '@/lib/interface';

export function useSellerDetailLogic() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);

  useEffect(() => {
    api.getDocument(id)
      .then(setDoc)
      .catch(() => router.replace('/seller'));
  }, [id, router]);

  function handleBack() {
    router.push('/seller');
  }

  return { doc, handleBack };
}
