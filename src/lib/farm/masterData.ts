import type { ZodType } from 'zod';
import {
  activityTypeSchema,
  documentTypeSchema,
  gradeSchema,
  packagingTypeSchema,
  rejectionReasonSchema,
  warehouseLocationSchema,
} from './schemas';

type MasterDataConfig = {
  table: string;
  entity: string;
  schema: ZodType<Record<string, unknown>>;
  orderBy: { column: string; ascending: boolean }[];
};

export const MASTER_DATA = {
  grades: {
    table: 'grades',
    entity: 'grade',
    schema: gradeSchema,
    orderBy: [{ column: 'sort_order', ascending: true }],
  },
  'packaging-types': {
    table: 'packaging_types',
    entity: 'packaging_type',
    schema: packagingTypeSchema,
    orderBy: [{ column: 'name', ascending: true }],
  },
  'document-types': {
    table: 'document_types',
    entity: 'document_type',
    schema: documentTypeSchema,
    orderBy: [
      { column: 'sort_order', ascending: true },
      { column: 'name', ascending: true },
    ],
  },
  'activity-types': {
    table: 'activity_types',
    entity: 'activity_type',
    schema: activityTypeSchema,
    orderBy: [
      { column: 'sort_order', ascending: true },
      { column: 'name', ascending: true },
    ],
  },
  'rejection-reasons': {
    table: 'rejection_reasons',
    entity: 'rejection_reason',
    schema: rejectionReasonSchema,
    orderBy: [
      { column: 'sort_order', ascending: true },
      { column: 'name', ascending: true },
    ],
  },
  'warehouse-locations': {
    table: 'warehouse_locations',
    entity: 'warehouse_location',
    schema: warehouseLocationSchema,
    orderBy: [
      { column: 'sort_order', ascending: true },
      { column: 'name', ascending: true },
    ],
  },
} satisfies Record<string, MasterDataConfig>;

export type MasterDataType = keyof typeof MASTER_DATA;

export function getMasterDataConfig(type: string): MasterDataConfig | null {
  return type in MASTER_DATA ? (MASTER_DATA[type as MasterDataType] as MasterDataConfig) : null;
}
