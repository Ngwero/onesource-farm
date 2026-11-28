'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarClock,
  Download,
  Leaf,
  Package,
  Scale,
  Tractor,
  TrendingUp,
  Wallet,
  Wheat,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows, MobileTableHint } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/farm/format';
import type { ExecutiveOverview } from '@/lib/farm/types';

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="farm-panel">
      <div className="farm-panel__header">
        <h2 className="farm-panel__title">
          {icon}
          {title}
        </h2>
      </div>
      <div className="farm-panel__body overflow-x-auto">
        <MobileTableHint className="px-4 pt-3" />
        {children}
      </div>
    </section>
  );
}

function ExecutivePage() {
  const currency = useCurrency();
  const { can } = useFarmAccess();
  const exec = useQuery({
    queryKey: [...farmKeys.overview, 'executive'],
    queryFn: () => farmFetch<ExecutiveOverview>('/api/farm/executive'),
  });

  if (exec.error) {
    return <ErrorState message={errorMessage(exec.error)} onRetry={() => exec.refetch()} />;
  }

  const d = exec.data;
  const loading = exec.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Executive overview"
        subtitle="Key farm numbers for the last 30 days."
        actions={
          can('reports.export') ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/reports?export=executive">
                <Download className="size-4" /> Export CSV
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Yield per hectare"
          loading={loading}
          value={d?.yieldPerHa != null ? fmtNumber(d.yieldPerHa, 2) : '—'}
          hint="Actual yield ÷ planted area"
          icon={<Wheat className="size-4" />}
        />
        <KpiCard
          label="Cost per kilogram"
          loading={loading}
          value={d?.costPerKg != null ? fmtMoney(d.costPerKg, currency) : '—'}
          hint="Field + harvest labour ÷ kg"
          icon={<Scale className="size-4" />}
        />
        <KpiCard
          label="Exportable"
          loading={loading}
          value={d?.exportablePct != null ? fmtPct(d.exportablePct, 0) : '—'}
          hint="Graded harvest, 30 days"
          icon={<TrendingUp className="size-4" />}
        />
        <KpiCard
          label="Rejected"
          loading={loading}
          value={d?.rejectionPct != null ? fmtPct(d.rejectionPct, 0) : '—'}
          hint="Graded harvest, 30 days"
          icon={<Package className="size-4" />}
        />
        <KpiCard
          label="Payroll this month"
          loading={loading}
          value={fmtMoney(d?.payroll.actual ?? 0, currency)}
          hint={
            d?.payroll.budget != null
              ? `Budget ${fmtMoney(d.payroll.budget, currency)} · ${
                  d.payroll.variance != null && d.payroll.variance >= 0 ? 'under' : 'over'
                } by ${fmtMoney(Math.abs(d.payroll.variance ?? 0), currency)}`
              : 'Set budget in System Settings'
          }
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          label="Harvests due"
          loading={loading}
          value={String(d?.upcomingHarvests.length ?? 0)}
          hint="Next 30 days"
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Costs by crop" icon={<Leaf className="size-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Crop</TableHead>
                <TableHead className="text-right">Labour</TableHead>
                <TableHead className="text-right">Inputs</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Cost/kg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows columns={5} rows={3} />
              ) : d?.costsByCrop.length ? (
                d.costsByCrop.map((row) => (
                  <TableRow key={row.crop}>
                    <TableCell className="font-medium">{row.crop}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(row.labourCost, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(row.inputCost, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtMoney(row.totalCost, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.costPerKg != null ? fmtMoney(row.costPerKg, currency) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow columns={5} title="No crop costs yet" description="Record field work to see labour and product costs by crop." />
              )}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Costs by block" icon={<Tractor className="size-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead className="text-right">Labour</TableHead>
                <TableHead className="text-right">Inputs</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Cost/kg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows columns={5} rows={3} />
              ) : d?.costsByBlock.length ? (
                d.costsByBlock.map((row) => (
                  <TableRow key={row.block}>
                    <TableCell className="font-medium">{row.block}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(row.labourCost, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(row.inputCost, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtMoney(row.totalCost, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.costPerKg != null ? fmtMoney(row.costPerKg, currency) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow columns={5} title="No block costs yet" description="Costs show here after field work is recorded on blocks." />
              )}
            </TableBody>
          </Table>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="How old is packed stock?" icon={<Package className="size-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Batches</TableHead>
                <TableHead className="text-right">Kg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows columns={3} rows={3} />
              ) : d?.stockAgeing.some((b) => b.batches > 0) ? (
                d.stockAgeing.map((row) => (
                  <TableRow key={row.bucket}>
                    <TableCell>{row.bucket}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.batches}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNumber(row.kg)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow columns={3} title="No packed stock yet" description="This fills after packed produce is put into the warehouse." />
              )}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Upcoming harvests" icon={<CalendarClock className="size-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Block</TableHead>
                <TableHead>Crop</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows columns={3} rows={3} />
              ) : d?.upcomingHarvests.length ? (
                d.upcomingHarvests.slice(0, 8).map((row, i) => (
                  <TableRow key={`${row.block}-${row.expectedHarvestDate}-${i}`}>
                    <TableCell className="whitespace-nowrap">{fmtDate(row.expectedHarvestDate)}</TableCell>
                    <TableCell className="font-medium">{row.block}</TableCell>
                    <TableCell>
                      {row.crop}
                      {row.expectedYield != null ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · {fmtNumber(row.expectedYield)} {row.unit ?? ''}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow columns={3} title="No harvests due in 30 days" description="When plantings have a harvest date, they show here." />
              )}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Revenue by buyer" icon={<BarChart3 className="size-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows columns={2} rows={3} />
              ) : d?.commercial.revenueByBuyer.length ? (
                d.commercial.revenueByBuyer.map((row) => (
                  <TableRow key={row.buyer}>
                    <TableCell className="font-medium">{row.buyer}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(row.amount, currency)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow
                  columns={2}
                  title="No buyer revenue yet"
                  description="Add buyers and shipments to track invoiced amounts."
                />
              )}
            </TableBody>
          </Table>
          {d?.commercial.revenueByShipment.length ? (
            <div className="space-y-1.5 border-t border-[#eef2ef] px-4 py-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Recent shipments</p>
              {d.commercial.revenueByShipment.slice(0, 5).map((s) => (
                <p key={s.shipment}>
                  {s.shipment} · {s.buyer} · {fmtMoney(s.amount, s.currency)} · {s.paymentStatus}
                </p>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission={['farm.view', 'profitability.view', 'reports.view', 'dashboard.view']}>
      <ExecutivePage />
    </RequirePermission>
  );
}
