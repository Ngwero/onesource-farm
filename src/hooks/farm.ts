'use client';

import { useQuery } from '@tanstack/react-query';
import { farmFetch } from '@/lib/farm/client';
import type {
  ActivityTypeRow,
  BlockRow,
  CropRow,
  FarmRow,
  InputLotRow,
  InputProductRow,
  OpenCycleOption,
  PackagingTypeRow,
  UserOption,
  VarietyRow,
  WarehouseLocationRow,
  WorkerRow,
} from '@/lib/farm/types';

export const farmKeys = {
  overview: ['farm', 'overview'] as const,
  profile: ['farm', 'profile'] as const,
  blocks: ['farm', 'blocks'] as const,
  block: (id: string) => ['farm', 'blocks', id] as const,
  crops: ['farm', 'crops'] as const,
  crop: (id: string) => ['farm', 'crops', id] as const,
  users: ['farm', 'users'] as const,
  master: (type: string) => ['farm', 'master', type] as const,
  settings: ['farm', 'settings'] as const,
  roles: ['farm', 'roles'] as const,
  userRoles: ['farm', 'user-roles'] as const,
  cycles: ['farm', 'cycles'] as const,
  workers: ['farm', 'workers'] as const,
  worker: (id: string) => ['farm', 'workers', id] as const,
  attendance: ['farm', 'attendance'] as const,
  tasks: ['farm', 'tasks'] as const,
  payroll: ['farm', 'payroll'] as const,
  payrollPeriod: (id: string) => ['farm', 'payroll', id] as const,
  activities: ['farm', 'activities'] as const,
  activity: (id: string) => ['farm', 'activities', id] as const,
  incidents: ['farm', 'incidents'] as const,
  incident: (id: string) => ['farm', 'incidents', id] as const,
  harvests: ['farm', 'harvests'] as const,
  harvest: (id: string) => ['farm', 'harvests', id] as const,
  attachments: (entityType: string, entityId: string) => ['farm', 'attachments', entityType, entityId] as const,
  packing: ['farm', 'packing'] as const,
  packingBatch: (id: string) => ['farm', 'packing', id] as const,
  packingSources: ['farm', 'packing', 'sources'] as const,
  qc: ['farm', 'qc'] as const,
  inspection: (id: string) => ['farm', 'qc', id] as const,
  qcSubjects: ['farm', 'qc', 'subjects'] as const,
  stock: ['farm', 'warehouse', 'stock'] as const,
  movements: ['farm', 'warehouse', 'movements'] as const,
  trace: ['farm', 'trace'] as const,
  buyers: ['farm', 'buyers'] as const,
  buyer: (id: string) => ['farm', 'buyers', id] as const,
  contracts: ['farm', 'contracts'] as const,
  contract: (id: string) => ['farm', 'contracts', id] as const,
  shipments: ['farm', 'shipments'] as const,
  shipment: (id: string) => ['farm', 'shipments', id] as const,
  inputProducts: ['farm', 'inputs', 'products'] as const,
  inputLots: ['farm', 'inputs', 'lots'] as const,
  inputMovements: ['farm', 'inputs', 'movements'] as const,
};

/** Everything that changes when packing, QC or stock records change. */
export const PACKHOUSE_KEYS = [
  farmKeys.packing,
  farmKeys.qc,
  farmKeys.stock,
  farmKeys.movements,
  farmKeys.trace,
  farmKeys.harvests,
  farmKeys.overview,
];

export type CropListItem = CropRow & {
  crop_varieties: Pick<VarietyRow, 'id' | 'code' | 'name' | 'status'>[];
  crop_grades: { grade_id: string }[];
};

export function useFarmUsers() {
  return useQuery({
    queryKey: farmKeys.users,
    queryFn: () => farmFetch<{ users: UserOption[] }>('/api/farm/users').then((r) => r.users),
    staleTime: 5 * 60_000,
  });
}

export function useCrops() {
  return useQuery({
    queryKey: farmKeys.crops,
    queryFn: () => farmFetch<{ crops: CropListItem[] }>('/api/farm/crops').then((r) => r.crops),
  });
}

export function useMasterList<T>(type: string) {
  return useQuery({
    queryKey: farmKeys.master(type),
    queryFn: () => farmFetch<{ items: T[] }>(`/api/farm/master/${type}`).then((r) => r.items),
  });
}

export function useBlocks() {
  return useQuery({
    queryKey: farmKeys.blocks,
    queryFn: () => farmFetch<{ blocks: BlockRow[] }>('/api/farm/blocks').then((r) => r.blocks),
  });
}

export function useWorkers() {
  return useQuery({
    queryKey: farmKeys.workers,
    queryFn: () => farmFetch<{ workers: WorkerRow[] }>('/api/farm/workers').then((r) => r.workers),
  });
}

/** Plantings that can take activities and harvests (active or harvesting). */
export function useOpenCycles() {
  return useQuery({
    queryKey: farmKeys.cycles,
    queryFn: () => farmFetch<{ cycles: OpenCycleOption[] }>('/api/farm/planting-cycles').then((r) => r.cycles),
  });
}

/** The farm's reporting currency; blank when the user cannot view the farm profile. */
export function useCurrency(): string {
  const profile = useQuery({
    queryKey: farmKeys.profile,
    queryFn: () => farmFetch<{ farm: FarmRow }>('/api/farm/profile').then((r) => r.farm),
    staleTime: 10 * 60_000,
    retry: false,
  });
  return profile.data?.default_currency ?? '';
}

export function useActivityTypes() {
  return useMasterList<ActivityTypeRow>('activity-types');
}

export function useWarehouseLocations() {
  return useMasterList<WarehouseLocationRow>('warehouse-locations');
}

export function usePackagingTypes() {
  return useMasterList<PackagingTypeRow>('packaging-types');
}

export function useInputProducts() {
  return useQuery({
    queryKey: farmKeys.inputProducts,
    queryFn: () => farmFetch<{ products: InputProductRow[] }>('/api/farm/inputs/products').then((r) => r.products),
  });
}

export function useInputLots(productId?: string | null) {
  const qs = productId ? `?product_id=${productId}` : '';
  return useQuery({
    queryKey: [...farmKeys.inputLots, productId ?? 'all'] as const,
    queryFn: () => farmFetch<{ lots: InputLotRow[] }>(`/api/farm/inputs/lots${qs}`).then((r) => r.lots),
  });
}
