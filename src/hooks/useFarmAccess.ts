'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmFetch } from '@/lib/farm/client';
import type { FarmAccess, Permission } from '@/lib/farm/permissions';

export function useFarmAccess() {
  const query = useQuery({
    queryKey: ['farm', 'me'],
    queryFn: () => farmFetch<FarmAccess>('/api/farm/me'),
    staleTime: 5 * 60_000,
  });

  const permissions = query.data?.permissions;
  const can = useCallback((p: Permission) => Boolean(permissions?.includes(p)), [permissions]);

  return { ...query, roles: query.data?.roles ?? [], can };
}
