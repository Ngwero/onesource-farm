'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, loading, dashboardRoute } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.must_set_password) {
      router.replace('/set-password');
      return;
    }
    router.replace(dashboardRoute);
  }, [user, loading, dashboardRoute, router]);

  return (
    <div className="min-h-screen flex items-center justify-center page-shell">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-200 border-t-brand-600" />
    </div>
  );
}
