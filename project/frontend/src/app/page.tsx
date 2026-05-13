'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log("🚀 ~ Home ~ token:", token)
    const role = localStorage.getItem('role');
    console.log("🚀 ~ Home ~ role:", role)
    if (!token) { router.replace('/login'); return; }
    router.replace(role === 'admin' ? '/admin' : '/seller');
  }, [router]);
  return null;
}
