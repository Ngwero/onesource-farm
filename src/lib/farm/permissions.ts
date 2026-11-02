export const PERMISSIONS = [
  'dashboard.view',
  'farm.view',
  'farm.manage',
  'crops.view',
  'crops.manage',
  'activities.view',
  'activities.record',
  'activities.manage',
  'pest.view',
  'pest.record',
  'workforce.view',
  'workforce.manage',
  'attendance.record',
  'payroll.view',
  'payroll.manage',
  'harvest.view',
  'harvest.record',
  'grading.record',
  'qc.view',
  'qc.inspect',
  'qc.approve',
  'qc.release',
  'packing.view',
  'packing.record',
  'warehouse.view',
  'warehouse.manage',
  'buyers.view',
  'buyers.manage',
  'contracts.view',
  'contracts.manage',
  'reservations.manage',
  'shipments.view',
  'shipments.manage',
  'documents.view',
  'documents.manage',
  'procurement.view',
  'procurement.request',
  'procurement.manage',
  'suppliers.manage',
  'finance.view',
  'invoices.manage',
  'payments.record',
  'costs.manage',
  'profitability.view',
  'claims.view',
  'claims.manage',
  'equipment.view',
  'equipment.manage',
  'traceability.view',
  'reports.view',
  'reports.export',
  'alerts.view',
  'alerts.manage',
  'admin.users',
  'admin.roles',
  'admin.settings',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export type FarmAccess = {
  roles: { id: string; slug: string; name: string }[];
  permissions: Permission[];
};
