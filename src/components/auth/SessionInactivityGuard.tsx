'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api/client';
import {
  CLIENT_LAST_ACTIVITY_KEY,
  SESSION_INACTIVITY_MS,
} from '@/lib/auth/inactivity';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'focus'] as const;
const CHECK_INTERVAL_MS = 30_000;
const SERVER_TOUCH_INTERVAL_MS = 60_000;
const CLIENT_PERSIST_INTERVAL_MS = 30_000;

export function SessionInactivityGuard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const lastActivityRef = useRef(Date.now());
  const lastServerTouchRef = useRef(0);
  const lastPersistRef = useRef(0);

  useEffect(() => {
    if (loading || !user) return;

    const expireSession = () => {
      sessionStorage.removeItem(CLIENT_LAST_ACTIVITY_KEY);
      void logout().then(() => {
        router.replace('/login?reason=timeout');
      });
    };

    const touchServer = () => {
      const now = Date.now();
      if (now - lastServerTouchRef.current < SERVER_TOUCH_INTERVAL_MS) return;
      lastServerTouchRef.current = now;
      void apiFetch('/api/auth/touch', { method: 'POST' });
    };

    const markActive = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (
        now - lastPersistRef.current >= CLIENT_PERSIST_INTERVAL_MS ||
        lastPersistRef.current === 0
      ) {
        lastPersistRef.current = now;
        sessionStorage.setItem(CLIENT_LAST_ACTIVITY_KEY, String(now));
      }
      touchServer();
    };

    const stored = sessionStorage.getItem(CLIENT_LAST_ACTIVITY_KEY);
    if (stored) {
      const ts = Number(stored);
      if (Number.isFinite(ts)) {
        if (Date.now() - ts >= SESSION_INACTIVITY_MS) {
          expireSession();
          return;
        }
        lastActivityRef.current = ts;
      }
    }

    markActive();

    const onActivity = () => markActive();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= SESSION_INACTIVITY_MS) {
        expireSession();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      window.clearInterval(interval);
    };
  }, [user, loading, logout, router]);

  return null;
}
