import type { Permission } from './permissions';

export const REPORT_TYPES = ['executive', 'activities', 'harvests', 'workers', 'stock', 'shipments'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

/** Shared by interactive exports, subscription saves, and scheduled delivery. */
export function canExportReport(type: ReportType, can: (p: Permission) => boolean): boolean {
  if (!can('reports.export')) return false;
  switch (type) {
    case 'executive': return can('reports.view') || can('farm.view') || can('profitability.view') || can('dashboard.view');
    case 'activities': return can('activities.view');
    case 'harvests': return can('harvest.view');
    case 'workers': return can('workforce.view');
    case 'stock': return can('warehouse.view') || can('packing.view');
    case 'shipments': return can('shipments.view') || can('buyers.view');
  }
}
