'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/context/AuthContext';
import { NotificationsPanel } from '../notifications/NotificationsPanel';
import { MemoGlobalSearch } from '../memo/MemoGlobalSearch';
import { ProductTour, TourHelpButton } from '../tour/ProductTour';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user?.must_set_password) {
      router.push('/set-password');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<aside className="w-[var(--sidebar-width)] bg-brand-950" />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 min-h-screen page-shell">
        <header className="app-topbar">
          <div className="app-topbar__inner">
            <p className="app-topbar__hint">
              Signed in as <strong>{user.full_name}</strong>
              {user.department?.name ? ` · ${user.department.name}` : ''}
            </p>
            <TourHelpButton />
            <MemoGlobalSearch />
            <NotificationsPanel />
          </div>
        </header>
        <main className="flex-1 p-5 sm:p-6 lg:p-8 overflow-auto">
          <div className="app-main">{children}</div>
        </main>
      </div>
      <ProductTour />
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
