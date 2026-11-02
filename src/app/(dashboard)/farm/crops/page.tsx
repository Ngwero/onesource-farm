'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { CropFormSheet } from '@/components/farm/forms/CropFormSheet';
import { useCrops } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage } from '@/lib/farm/client';
import { optionLabel } from '@/lib/farm/schemas';

const COLUMNS = 7;

function CropsPage() {
  const router = useRouter();
  const { can } = useFarmAccess();
  const crops = useCrops();
  const [creating, setCreating] = useState(false);

  const newButton = can('crops.manage') ? (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" /> New crop
    </Button>
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Crops"
        subtitle="Crops grown on the farm, their varieties, grades and quality checks."
        actions={newButton}
      />

      {crops.error ? (
        <ErrorState message={errorMessage(crops.error)} onRetry={() => crops.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Crop</TableHead>
                <TableHead>Production cycle</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Days to maturity</TableHead>
                <TableHead>Varieties</TableHead>
                <TableHead className="text-right">Grades</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : !crops.data?.length ? (
                <EmptyRow
                  columns={COLUMNS}
                  title="No crops yet"
                  description="Add the crops the farm grows before recording plantings."
                  action={newButton}
                />
              ) : (
                crops.data.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/farm/crops/${c.id}`)}>
                    <TableCell>
                      <Link
                        href={`/farm/crops/${c.id}`}
                        className="font-semibold text-brand-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {c.code}
                        {c.scientific_name ? <span className="italic"> · {c.scientific_name}</span> : null}
                      </p>
                    </TableCell>
                    <TableCell>{optionLabel(c.production_cycle)}</TableCell>
                    <TableCell>{c.default_unit}</TableCell>
                    <TableCell className="text-right">{c.maturity_days ?? '—'}</TableCell>
                    <TableCell className="max-w-64">
                      {c.crop_varieties.length ? (
                        <span className="line-clamp-2">
                          {c.crop_varieties
                            .filter((v) => v.status === 'active')
                            .map((v) => v.name)
                            .join(', ') || '—'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{c.crop_grades.length}</TableCell>
                    <TableCell>
                      <StatusChip status={c.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CropFormSheet open={creating} onOpenChange={setCreating} onSaved={(crop) => router.push(`/farm/crops/${crop.id}`)} />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="crops.view">
      <CropsPage />
    </RequirePermission>
  );
}
