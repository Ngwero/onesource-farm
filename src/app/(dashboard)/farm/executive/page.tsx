'use client';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows, MobileTableHint } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/farm/format';
import type { ExecutiveOverview } from '@/lib/farm/types';

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
    <div className="space-y-6">
      <PageHeader
        title="Executive overview"
        subtitle="Yield, field cost, quality, payroll, stock ageing, upcoming harvests, and export revenue — last 30 days."
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Yield per hectare"
          value={loading ? '…' : d?.yieldPerHa != null ? fmtNumber(d.yieldPerHa, 2) : '—'}
          hint="Actual yield ÷ planted area"
          icon={<Wheat className="size-4" />}
        />
        <KpiCard
          label="Cost per kilogram"
          value={loading ? '…' : d?.costPerKg != null ? fmtMoney(d.costPerKg, currency) : '—'}
          hint="Field + harvest labour ÷ kg"
          icon={<Scale className="size-4" />}
        />
        <KpiCard
          label="Exportable"
          value={loading ? '…' : d?.exportablePct != null ? fmtPct(d.exportablePct, 0) : '—'}
          hint="Graded harvest, 30 days"
          icon={<TrendingUp className="size-4" />}
        />
        <KpiCard
          label="Rejected"
          value={loading ? '…' : d?.rejectionPct != null ? fmtPct(d.rejectionPct, 0) : '—'}
          hint="Graded harvest, 30 days"
          icon={<Package className="size-4" />}
        />
        <KpiCard
          label="Payroll this month"
          value={loading ? '…' : fmtMoney(d?.payroll.actual ?? 0, currency)}
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
          value={loading ? '…' : String(d?.upcomingHarvests.length ?? 0)}
          hint="Next 30 days"
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="size-4 text-brand-600" /> Costs by crop
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MobileTableHint />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card">Crop</TableHead>
                  <TableHead className="text-right">Labour</TableHead>
                  <TableHead className="text-right">Inputs</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Cost/kg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingRows columns={5} />
                ) : d?.costsByCrop.length ? (
                  d.costsByCrop.map((row) => (
                    <TableRow key={row.crop}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">{row.crop}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.labourCost, currency)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.inputCost, currency)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.totalCost, currency)}</TableCell>
                      <TableCell className="text-right">
                        {row.costPerKg != null ? fmtMoney(row.costPerKg, currency) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow columns={5} title="No activity costs in the last 30 days." />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tractor className="size-4 text-brand-600" /> Costs by block
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MobileTableHint />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card">Block</TableHead>
                  <TableHead className="text-right">Labour</TableHead>
                  <TableHead className="text-right">Inputs</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Cost/kg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingRows columns={5} />
                ) : d?.costsByBlock.length ? (
                  d.costsByBlock.map((row) => (
                    <TableRow key={row.block}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">{row.block}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.labourCost, currency)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.inputCost, currency)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.totalCost, currency)}</TableCell>
                      <TableCell className="text-right">
                        {row.costPerKg != null ? fmtMoney(row.costPerKg, currency) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow columns={5} title="No block costs in the last 30 days." />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4 text-brand-600" /> Stock ageing
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MobileTableHint />
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
                  <LoadingRows columns={3} />
                ) : d?.stockAgeing.some((b) => b.batches > 0) ? (
                  d.stockAgeing.map((row) => (
                    <TableRow key={row.bucket}>
                      <TableCell>{row.bucket}</TableCell>
                      <TableCell className="text-right">{row.batches}</TableCell>
                      <TableCell className="text-right">{fmtNumber(row.kg)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow columns={3} title="No packed stock received yet." />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-brand-600" /> Upcoming harvests
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MobileTableHint />
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
                  <LoadingRows columns={3} />
                ) : d?.upcomingHarvests.length ? (
                  d.upcomingHarvests.slice(0, 8).map((row, i) => (
                    <TableRow key={`${row.block}-${row.expectedHarvestDate}-${i}`}>
                      <TableCell>{fmtDate(row.expectedHarvestDate)}</TableCell>
                      <TableCell>{row.block}</TableCell>
                      <TableCell>
                        {row.crop}
                        {row.expectedYield != null
                          ? ` · ${fmtNumber(row.expectedYield)} ${row.unit ?? ''}`
                          : ''}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow columns={3} title="No harvests scheduled in the next 30 days." />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-brand-600" /> Revenue by buyer
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MobileTableHint />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingRows columns={2} />
                ) : d?.commercial.revenueByBuyer.length ? (
                  d.commercial.revenueByBuyer.map((row) => (
                    <TableRow key={row.buyer}>
                      <TableCell>{row.buyer}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.amount, currency)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow
                    columns={2}
                    title="Add buyers and shipments to see revenue by buyer, crop, and shipment."
                  />
                )}
              </TableBody>
            </Table>
            {d?.commercial.revenueByShipment.length ? (
              <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Recent shipments</p>
                {d.commercial.revenueByShipment.slice(0, 5).map((s) => (
                  <p key={s.shipment}>
                    {s.shipment} · {s.buyer} · {fmtMoney(s.amount, s.currency)} · {s.paymentStatus}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
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
