'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  CalendarClock,
  Download,
  FileSpreadsheet,
  Mail,
  Package,
  Tractor,
  Truck,
  Users,
  Wheat,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MobileTableHint } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { useAuth } from '@/context/AuthContext';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { FarmApiError, errorMessage, farmFetch } from '@/lib/farm/client';
import type { ReportType } from '@/lib/farm/reportTypes';
import { REPORT_TYPES } from '@/lib/farm/reportTypes';

type ExportOption = {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  permission?: Parameters<ReturnType<typeof useFarmAccess>['can']>[0];
};

const EXPORTS: ExportOption[] = [
  {
    type: 'executive',
    title: 'Executive KPIs',
    description: 'Yield, cost, quality, payroll, stock ageing, and commercial summary.',
    icon: <FileSpreadsheet className="size-4" />,
  },
  {
    type: 'activities',
    title: 'Activities',
    description: 'Field activities with labour and input cost totals.',
    icon: <Tractor className="size-4" />,
    permission: 'activities.view',
  },
  {
    type: 'harvests',
    title: 'Harvests',
    description: 'Harvest batches with block, crop, quantity, and QC status.',
    icon: <Wheat className="size-4" />,
    permission: 'harvest.view',
  },
  {
    type: 'workers',
    title: 'Workers',
    description: 'Workforce register including pay basis and contact.',
    icon: <Users className="size-4" />,
    permission: 'workforce.view',
  },
  {
    type: 'stock',
    title: 'Stock',
    description: 'Packed batches with warehouse balances.',
    icon: <Package className="size-4" />,
    permission: 'warehouse.view',
  },
  {
    type: 'shipments',
    title: 'Buyers & shipments',
    description: 'Buyer directory and export shipment status.',
    icon: <Truck className="size-4" />,
    permission: 'shipments.view',
  },
];

type DigestState = {
  email: string;
  cadence: 'daily' | 'weekly';
  weekday: number;
  hour_utc: number;
  is_active: boolean;
  report_types: ReportType[];
  last_sent_at: string | null;
};

const EMPTY_DIGEST: DigestState = {
  email: '',
  cadence: 'weekly',
  weekday: 1,
  hour_utc: 6,
  is_active: false,
  report_types: ['executive'],
  last_sent_at: null,
};

async function downloadCsv(type: ReportType) {
  const res = await fetch(`/api/farm/reports/export?type=${type}&format=csv`, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new FarmApiError(data.error || `Export failed (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `${type}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const { user } = useAuth();
  const [busy, setBusy] = useState<ReportType | null>(null);
  const [digest, setDigest] = useState<DigestState>(EMPTY_DIGEST);
  const [digestLoading, setDigestLoading] = useState(true);
  const [savingDigest, setSavingDigest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await farmFetch<{
          subscription: {
            email: string;
            cadence: 'daily' | 'weekly';
            weekday: number;
            hour_utc: number;
            is_active: boolean;
            report_types: string[];
            last_sent_at: string | null;
          } | null;
        }>('/api/farm/digests');
        if (cancelled) return;
        if (res.subscription) {
          const types = res.subscription.report_types.filter((t) =>
            (REPORT_TYPES as readonly string[]).includes(t)
          ) as ReportType[];
          setDigest({
            email: res.subscription.email,
            cadence: res.subscription.cadence,
            weekday: res.subscription.weekday,
            hour_utc: res.subscription.hour_utc,
            is_active: res.subscription.is_active,
            report_types: types.length ? types : ['executive'],
            last_sent_at: res.subscription.last_sent_at,
          });
        } else if (user?.email) {
          setDigest((d) => ({ ...d, email: user.email }));
        }
      } catch (error) {
        if (!cancelled) toast.error(`Could not load digest schedule: ${errorMessage(error)}`);
        if (!cancelled && user?.email) setDigest((d) => ({ ...d, email: user.email }));
      } finally {
        if (!cancelled) setDigestLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    const auto = searchParams.get('export');
    if (!auto || !can('reports.export')) return;
    const option = EXPORTS.find((e) => e.type === auto);
    if (!option) return;
    if (option.permission && !can(option.permission) && option.type !== 'executive') return;
    void (async () => {
      try {
        setBusy(option.type);
        await downloadCsv(option.type);
        toast.success(`${option.title} downloaded`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Export failed');
      } finally {
        setBusy(null);
      }
    })();
  }, [searchParams, can]);

  const saveDigest = async () => {
    if (digest.is_active && !digest.email.trim()) {
      toast.error('Enter an email address to enable digests');
      return;
    }
    if (!digest.report_types.length) {
      toast.error('Select at least one report type');
      return;
    }
    setSavingDigest(true);
    try {
      const res = await farmFetch<{
        subscription: { last_sent_at: string | null };
      }>('/api/farm/digests', {
        method: 'PUT',
        body: {
          email: digest.email.trim().toLowerCase(),
          report_types: digest.report_types,
          cadence: digest.cadence,
          weekday: digest.weekday,
          hour_utc: digest.hour_utc,
          is_active: digest.is_active,
        },
      });
      setDigest((d) => ({ ...d, last_sent_at: res.subscription.last_sent_at }));
      toast.success(digest.is_active ? 'Email digest scheduled' : 'Digest subscription saved (paused)');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingDigest(false);
    }
  };

  const visible = EXPORTS.filter((e) => {
    if (e.type === 'executive') return true;
    if (e.type === 'stock') return can('warehouse.view') || can('packing.view');
    if (e.type === 'shipments') return can('shipments.view') || can('buyers.view');
    return !e.permission || can(e.permission);
  });

  const toggleType = (type: ReportType) => {
    setDigest((d) => {
      const has = d.report_types.includes(type);
      const next = has ? d.report_types.filter((t) => t !== type) : [...d.report_types, type];
      return { ...d, report_types: next.length ? next : ['executive'] };
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Download operational CSVs or schedule email digests."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4 text-brand-600" /> Operational exports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MobileTableHint />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="text-right">Export</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((opt) => (
                <TableRow key={opt.type}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="text-brand-700">{opt.icon}</span>
                      {opt.title}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground sm:hidden">{opt.description}</p>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{opt.description}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!can('reports.export') || busy === opt.type}
                      onClick={async () => {
                        try {
                          setBusy(opt.type);
                          await downloadCsv(opt.type);
                          toast.success(`${opt.title} downloaded`);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Export failed');
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      <Download className="size-4" />
                      {busy === opt.type ? 'Exporting…' : 'CSV'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!can('reports.export') ? (
            <p className="mt-3 text-sm text-muted-foreground">You can view reports but need reports.export to download CSVs.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-brand-600" /> Scheduled email digests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {digestLoading ? (
            <p className="text-sm text-muted-foreground">Loading subscription…</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Choose when to receive your farm reports. CSV summaries are included in the email body.
                Delivery runs hourly, shortly after the selected hour.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="digest-email">Email</Label>
                  <Input
                    id="digest-email"
                    type="email"
                    placeholder="ops@example.com"
                    value={digest.email}
                    onChange={(e) => setDigest((s) => ({ ...s, email: e.target.value }))}
                    disabled={!can('reports.export')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="digest-hour">Hour (UTC)</Label>
                  <Input
                    id="digest-hour"
                    type="number"
                    min={0}
                    max={23}
                    value={digest.hour_utc}
                    onChange={(e) =>
                      setDigest((s) => ({ ...s, hour_utc: Math.min(23, Math.max(0, Number(e.target.value) || 0)) }))
                    }
                    disabled={!can('reports.export')}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Enable digests</p>
                    <p className="text-xs text-muted-foreground">Send reports on this schedule</p>
                  </div>
                  <Switch
                    checked={digest.is_active}
                    onCheckedChange={(is_active) => setDigest((s) => ({ ...s, is_active }))}
                    disabled={!can('reports.export')}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Label className="text-sm">Cadence</Label>
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-sm"
                    value={digest.cadence}
                    onChange={(e) =>
                      setDigest((s) => ({ ...s, cadence: e.target.value as 'daily' | 'weekly' }))
                    }
                    disabled={!can('reports.export')}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  {digest.cadence === 'weekly' ? (
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                      value={digest.weekday}
                      onChange={(e) => setDigest((s) => ({ ...s, weekday: Number(e.target.value) }))}
                      disabled={!can('reports.export')}
                    >
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Include reports</Label>
                <div className="flex flex-wrap gap-2">
                  {visible.map((opt) => {
                    const on = digest.report_types.includes(opt.type);
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        disabled={!can('reports.export')}
                        onClick={() => toggleType(opt.type)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          on
                            ? 'border-brand-600 bg-brand-50 text-brand-800'
                            : 'border-slate-200 bg-white text-muted-foreground'
                        }`}
                      >
                        {opt.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              {digest.last_sent_at ? (
                <p className="text-xs text-muted-foreground">
                  Last sent {new Date(digest.last_sent_at).toLocaleString()}
                </p>
              ) : null}

              <Button onClick={() => void saveDigest()} disabled={!can('reports.export') || savingDigest}>
                <Activity className="size-4" />
                {savingDigest ? 'Saving…' : 'Save digest schedule'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="reports.view">
      <Suspense>
        <ReportsPage />
      </Suspense>
    </RequirePermission>
  );
}
