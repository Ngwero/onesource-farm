'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { ErrorState } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { NumberField, SelectField, TextField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useFormMutation } from '@/hooks/useFormMutation';
import { FarmApiError, errorMessage, farmFetch } from '@/lib/farm/client';
import { SYSTEM_SETTINGS, type SystemSettingKey } from '@/lib/farm/schemas';

type Values = Record<string, unknown>;

const GROUPS: { prefix: string; title: string; description: string }[] = [
  { prefix: 'general', title: 'General', description: 'Defaults used across the farm modules.' },
  {
    prefix: 'ememo',
    title: 'Approvals',
    description: 'Amounts at or above these limits are sent to OneSource for approval before they can proceed.',
  },
  {
    prefix: 'workforce',
    title: 'Labour costing',
    description: 'Used to work out the hourly cost of each worker when labour is recorded on activities and harvests.',
  },
  { prefix: 'alerts', title: 'Alerts', description: 'How far ahead the system warns about upcoming events.' },
];

const KEYS = Object.keys(SYSTEM_SETTINGS) as SystemSettingKey[];
const fieldName = (key: SystemSettingKey) => key.replace(/\./g, '__');
const settingKey = (field: string) => field.replace(/__/g, '.') as SystemSettingKey;

const formSchema = z.object(Object.fromEntries(KEYS.map((k) => [fieldName(k), SYSTEM_SETTINGS[k].schema])));

function SettingField({ settingKey: key, disabled }: { settingKey: SystemSettingKey; disabled: boolean }) {
  const def = SYSTEM_SETTINGS[key];
  const name = fieldName(key);
  if (def.schema instanceof z.ZodEnum) {
    const options = (def.schema.options as string[]).map((v) => ({ value: v, label: v }));
    return <SelectField<Values> name={name} label={def.label} required options={options} disabled={disabled} />;
  }
  if (def.kind === 'number') {
    return <NumberField<Values> name={name} label={def.label} required disabled={disabled} />;
  }
  return <TextField<Values> name={name} label={def.label} required uppercase disabled={disabled} />;
}

function SystemSettingsPage() {
  const { can } = useFarmAccess();
  const settings = useQuery({
    queryKey: farmKeys.settings,
    queryFn: () => farmFetch<{ settings: Record<string, unknown> }>('/api/farm/settings').then((r) => r.settings),
  });

  const form = useForm<Values>({ resolver: zodResolver(formSchema) as never });
  const initial = useMemo(
    () => (settings.data ? Object.fromEntries(KEYS.map((k) => [fieldName(k), settings.data[k] ?? null])) : null),
    [settings.data]
  );

  useEffect(() => {
    if (initial) form.reset(initial);
  }, [initial, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch('/api/farm/settings', {
        method: 'PUT',
        body: Object.fromEntries(Object.entries(values).map(([f, v]) => [settingKey(f), v])),
      }).catch((err: unknown) => {
        if (err instanceof FarmApiError && err.fieldErrors) {
          const mapped = Object.fromEntries(
            Object.entries(err.fieldErrors).map(([k, msg]) => [fieldName(k as SystemSettingKey), msg])
          );
          throw new FarmApiError(err.message, err.status, mapped);
        }
        throw err;
      }),
    { success: 'Settings saved', invalidate: [farmKeys.settings] }
  );

  if (settings.error) return <ErrorState message={errorMessage(settings.error)} onRetry={() => settings.refetch()} />;
  if (!initial) return <div className="dashboard-loading">Loading settings…</div>;

  const disabled = save.isPending;

  return (
    <div className="space-y-5">
      <PageHeader title="System settings" subtitle="Farm-wide defaults, approval limits and alert timing." />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          className="max-w-3xl space-y-5"
          noValidate
        >
          {form.formState.errors.root?.message ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          {GROUPS.map((g) => (
            <Card key={g.prefix}>
              <CardHeader>
                <CardTitle className="text-base">{g.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{g.description}</p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {KEYS.filter((k) => k.startsWith(`${g.prefix}.`)).map((k) => (
                  <SettingField key={k} settingKey={k} disabled={disabled || !can('admin.settings')} />
                ))}
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => form.reset(initial)} disabled={disabled || !form.formState.isDirty}>
              Discard changes
            </Button>
            <Button type="submit" disabled={disabled || !form.formState.isDirty}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="admin.settings">
      <SystemSettingsPage />
    </RequirePermission>
  );
}
