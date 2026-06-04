'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filter === 'unread') params.set('unread', '1');
      const res = await apiFetch(`/api/notifications?${params}`);
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(ids: string[]) {
    await apiFetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_ids: ids }),
    });
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - ids.length));
  }

  async function markAllRead() {
    await apiFetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bell size={24} className="text-brand-600" />
            Notifications
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-center py-12">Loading...</p>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <Bell size={40} className="mx-auto mb-3 opacity-40" />
          <p>No notifications{filter === 'unread' ? ' unread' : ''}.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`card p-4 ${!n.is_read ? 'ring-1 ring-brand-200 bg-brand-50/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{n.title}</p>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(n.created_at).toLocaleString()}
                    {n.type ? ` · ${n.type.replace(/_/g, ' ')}` : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {n.memo_id && (
                    <Link
                      href={`/memos/${n.memo_id}`}
                      onClick={() => !n.is_read && void markRead([n.id])}
                      className="btn-primary text-xs flex items-center gap-1 py-1.5 px-2.5"
                    >
                      <ExternalLink size={14} />
                      View memo
                    </Link>
                  )}
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => markRead([n.id])}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
