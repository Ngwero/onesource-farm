'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { ErrorState } from '@/components/farm/DataStates';
import { Detail } from '@/components/farm/Detail';
import { PhotoGallery } from '@/components/farm/PhotoGallery';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { IncidentFormSheet } from '@/components/farm/forms/IncidentFormSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtDateTime, fmtHa } from '@/lib/farm/format';
import { optionLabel } from '@/lib/farm/schemas';
import type { IncidentRow } from '@/lib/farm/types';

function TextBlock({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const canRecord = can('pest.record');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const incident = useQuery({
    queryKey: farmKeys.incident(id),
    queryFn: () => farmFetch<{ incident: IncidentRow }>(`/api/farm/incidents/${id}`).then((r) => r.incident),
  });

  const remove = useActionMutation(() => farmFetch(`/api/farm/incidents/${id}`, { method: 'DELETE' }), {
    success: 'Incident deleted',
    invalidate: [farmKeys.incidents],
    onDone: () => router.push('/farm/incidents'),
  });

  if (incident.error) return <ErrorState message={errorMessage(incident.error)} onRetry={() => incident.refetch()} />;
  const i = incident.data;
  if (!i) return <div className="dashboard-loading">Loading incident…</div>;

  return (
    <div className="space-y-6">
      <Link href="/farm/incidents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Pest & Disease
      </Link>

      <PageHeader
        title={i.name}
        meta={
          <span className="flex gap-2">
            <StatusChip status={i.status} />
            <StatusChip status={i.severity} label={`${optionLabel(i.severity)} severity`} />
          </span>
        }
        subtitle={`${optionLabel(i.incident_type)} · Block ${i.block?.code ?? ''}${i.crop ? ` · ${i.crop.name}` : ''}`}
        actions={
          canRecord ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button variant="outline" onClick={() => setDeleting(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            </>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Detail
              label="Block"
              value={
                i.block ? (
                  <Link href={`/farm/blocks/${i.block.id}`} className="text-brand-700 hover:underline">
                    {i.block.code} · {i.block.name}
                  </Link>
                ) : null
              }
            />
            <Detail label="Crop" value={i.crop?.name} />
            <Detail label="Identified" value={fmtDate(i.date_identified)} />
            <Detail label="Area affected" value={i.area_affected_ha == null ? null : fmtHa(i.area_affected_ha)} />
            <Detail label="Responsible" value={i.supervisor?.full_name} />
            <Detail label="Follow up" value={i.follow_up_date ? fmtDate(i.follow_up_date) : null} />
            <Detail label="Resolved" value={i.resolved_date ? fmtDate(i.resolved_date) : null} />
            <Detail label="Reported" value={`${i.reported_by_user?.full_name ?? '—'}, ${fmtDateTime(i.created_at)}`} />
          </dl>
          <TextBlock label="What was observed" text={i.description} />
          <TextBlock label="Action taken" text={i.action_taken} />
          <TextBlock label="Treatment" text={i.treatment} />
        </CardContent>
      </Card>

      <PhotoGallery entityType="pest_disease_incident" entityId={i.id} canEdit={canRecord} />

      <IncidentFormSheet open={editing} onOpenChange={setEditing} incident={i} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${i.name}?`}
        description="Use this only for incidents entered by mistake. Mark real incidents resolved to keep the history. Photos are deleted too."
        confirmLabel="Delete incident"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="pest.view">
      <IncidentDetailPage />
    </RequirePermission>
  );
}
