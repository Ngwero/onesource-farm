'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api/client';
import type { MemoFinancialSummary } from '@/lib/memo/financial';

export function useMemos(filters?: Record<string, string>) {
  const { user, loading: authLoading } = useAuth();
  const [memos, setMemos] = useState<unknown[]>([]);
  const [financialSummary, setFinancialSummary] = useState<MemoFinancialSummary | null>(null);
  const [paymentTrackingEnabled, setPaymentTrackingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  const fetchMemos = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const parsed = JSON.parse(filterKey) as Record<string, string>;
      const params = new URLSearchParams(parsed);
      const res = await apiFetch(`/api/memos?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemos(data.memos || []);
      setFinancialSummary(data.financial_summary || null);
      setPaymentTrackingEnabled(data.payment_tracking_enabled !== false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user?.id, filterKey]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    void fetchMemos();
  }, [authLoading, user?.id, fetchMemos]);

  return {
    memos,
    financialSummary,
    paymentTrackingEnabled,
    loading: loading || authLoading,
    error,
    refetch: fetchMemos,
  };
}
