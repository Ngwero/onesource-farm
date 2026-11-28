'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BulkUploadCard } from '@/components/farm/BulkUploadCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import {
  BULK_IMPORT_SPECS,
  type BulkImportKind,
} from '@/lib/farm/bulkImportCatalog';

const KIND_ORDER: BulkImportKind[] = [
  'workers',
  'attendance',
  'blocks',
  'crops',
  'varieties',
  'buyers',
  'contracts',
  'shipments',
  'input-products',
  'input-lots',
  'incidents',
];

function ImportPage() {
  const { can } = useFarmAccess();
  const available = useMemo(
    () => KIND_ORDER.filter((k) => can(BULK_IMPORT_SPECS[k].permission)),
    [can]
  );
  const [kind, setKind] = useState<BulkImportKind>(available[0] ?? 'workers');
  const activeKind = available.includes(kind) ? kind : available[0];

  if (!activeKind) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bulk upload" subtitle="Upload Excel files to add many records at once." />
        <p className="text-sm text-muted-foreground">You do not have permission to bulk upload data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk upload"
        subtitle="Download a sample Excel template, fill it in, then upload to add many records at once."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-brand-600" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Choose what you want to import.</p>
          <p>2. Download the Excel template (it has one sample row).</p>
          <p>3. Fill in your rows. Keep the column names the same.</p>
          <p>4. Upload the file and click Import.</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {available.map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={activeKind === k ? 'default' : 'outline'}
            onClick={() => setKind(k)}
          >
            {BULK_IMPORT_SPECS[k].title}
          </Button>
        ))}
      </div>

      <BulkUploadCard key={activeKind} kind={activeKind} />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission
      permission={[
        'admin.settings',
        'workforce.manage',
        'attendance.record',
        'farm.manage',
        'crops.manage',
        'buyers.manage',
        'contracts.manage',
        'shipments.manage',
        'procurement.manage',
        'pest.record',
      ]}
    >
      <ImportPage />
    </RequirePermission>
  );
}
