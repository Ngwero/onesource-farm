'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api/client';
import type { Notification } from '@/types';

export function NotificationsPanel() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.id || loading) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/notifications?limit=20');
      const d = await res.json();
      setNotifications(d.notifications || []);
      setLoaded(true);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user?.id, loading]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      void loadNotifications();
    }
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        data-tour-id="tour-notifications"
        className="relative p-2.5 rounded-xl bg-white border border-slate-200/80 text-brand-700 shadow-sm hover:border-brand-200 hover:shadow transition-all"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 dropdown-panel z-50 p-0 overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <span className="font-semibold text-sm text-slate-800">Notifications</span>
            <Link href="/notifications" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-slate-500 text-center">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">No notifications</p>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <Link
                  key={n.id}
                  href={n.memo_id ? `/memos/${n.memo_id}` : '/notifications'}
                  className={`block p-3 border-b border-slate-100 text-sm hover:bg-slate-50 ${!n.is_read ? 'bg-brand-50/80' : ''}`}
                >
                  <p className="font-medium text-slate-800">{n.title}</p>
                  <p className="text-slate-500 text-xs mt-1 line-clamp-2">{n.message}</p>
                  <p className="text-slate-400 text-xs mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
