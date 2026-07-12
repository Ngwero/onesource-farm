'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/context/AuthContext';
import { NotificationsPanel } from '../notifications/NotificationsPanel';
import { MemoGlobalSearch } from '../memo/MemoGlobalSearch';
import { ProductTour, TourHelpButton } from '../tour/ProductTour';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user?.must_set_password) {
      router.push('/set-password');
    }
  }, [user, loading, router]);

  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNav();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen, closeNav]);

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
      <button
        type="button"
        className={`app-nav-overlay${navOpen ? ' app-nav-overlay--open' : ''}`}
        aria-label="Close menu"
        onClick={closeNav}
      />
      <Suspense fallback={<aside className="app-sidebar" aria-hidden />}>
        <Sidebar open={navOpen} onClose={closeNav} />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 min-h-screen page-shell">
        <header className="app-topbar">
          <div className="app-topbar__inner">
            <button
              type="button"
              className="app-nav-toggle"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              {navOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <p className="app-topbar__hint">
              Signed in as <strong>{user.full_name}</strong>
              {user.department?.name ? ` · ${user.department.name}` : ''}
            </p>
            <div className="app-topbar__actions">
              <TourHelpButton />
              <MemoGlobalSearch />
              <NotificationsPanel />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-5 md:p-6 xl:p-8 overflow-auto">
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
