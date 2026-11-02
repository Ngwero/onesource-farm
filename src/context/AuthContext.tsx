'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, RoleSlug } from '@/types';
import { resolveDashboardRoute } from '@/lib/auth/rbac';
import { mergeUserProfile, normalizeUserProfile } from '@/lib/auth/profile';
import { apiFetch } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';
import { CLIENT_LAST_ACTIVITY_KEY } from '@/lib/auth/inactivity';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setUserFromProfile: (profile: User) => void;
  refreshProfile: () => Promise<User | null>;
  dashboardRoute: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'onesource_ememo_user';
const PENDING_KEY = 'onesource_ememo_pending';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const persistUser = useCallback((profile: User) => {
    if (profile.must_set_password) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(profile));
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      sessionStorage.removeItem(PENDING_KEY);
    }
    setUser(profile);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        const profile = normalizeUserProfile(data.user);
        if (profile) {
          persistUser(profile);
          return profile;
        }
      }
      if (res.status === 401) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(PENDING_KEY);
        sessionStorage.removeItem(CLIENT_LAST_ACTIVITY_KEY);
        setUser(null);
      }
    } catch {
      /* fall through */
    }
    return null;
  }, [persistUser]);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const profile = await refreshSession();
          if (profile) {
            setLoading(false);
            return;
          }
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = normalizeUserProfile(JSON.parse(stored));
          if (parsed && !parsed.must_set_password) {
            setUser(parsed);
            void refreshSession();
            setLoading(false);
            return;
          }
          localStorage.removeItem(STORAGE_KEY);
        }

        const pending = sessionStorage.getItem(PENDING_KEY);
        if (pending) {
          const parsed = normalizeUserProfile(JSON.parse(pending));
          if (parsed?.must_set_password) setUser(parsed);
          else sessionStorage.removeItem(PENDING_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(PENDING_KEY);
      }
      setLoading(false);
    }
    void init();
  }, [refreshSession]);

  const setUserFromProfile = useCallback(
    (profile: User | Record<string, unknown>) => {
      const normalized = normalizeUserProfile(profile as Record<string, unknown>);
      if (!normalized) return;
      let merged = normalized;
      setUser((prev) => {
        merged = mergeUserProfile(prev, normalized);
        return merged;
      });
      persistUser(merged);
    },
    [persistUser]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      const profile = normalizeUserProfile(data.user) || (data.user as User);
      if (!profile) throw new Error('Profile not found');

      const mustSetPassword = Boolean(data.must_set_password);
      profile.must_set_password = mustSetPassword;
      persistUser(profile);
      sessionStorage.setItem(CLIENT_LAST_ACTIVITY_KEY, String(Date.now()));
      return mustSetPassword;
    },
    [persistUser]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    sessionStorage.removeItem(CLIENT_LAST_ACTIVITY_KEY);
    setUser(null);
  }, []);

  const dashboardRoute = resolveDashboardRoute(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        setUserFromProfile,
        refreshProfile: refreshSession,
        dashboardRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
