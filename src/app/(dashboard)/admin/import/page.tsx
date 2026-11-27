'use client';

import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileUp, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { farmFetch, errorMessage } from '@/lib/farm/client';
import { downloadImportTemplate, parseSpreadsheetFile } from '@/lib/farm/spreadsheet';

type ImportKind = 'workers' | 'blocks' | 'crops';

type ImportSpec = {
  title: string;
  required: string[];
  optional: string[];
  description: string;
  permission: 'workforce.manage' | 'farm.manage' | 'crops.manage';
  endpoint: string;
  sample: (string | number | null)[];
};

const SPECS: Record<ImportKind, ImportSpec> = {
  workers: {
    title: 'Workers',
    required: ['worker_code', 'full_name', 'category', 'pay_basis'],
    optional: [
      'phone',
      'national_id',
      'job_role',
      'status',
      'start_date',
      'daily_rate',
      'monthly_salary',
      'overtime_rate',
      'notes',
    ],
    description: 'Add many workers at once. Use daily_rate for daily pay, or monthly_salary for monthly pay.',
    permission: 'workforce.manage',
    endpoint: '/api/farm/import/workers',
    sample: ['W-001', 'Jane Okello', 'casual', 'daily', '0700000000', '', 'Picker', 'active', '2026-01-15', 25000, '', 0, ''],
  },
  blocks: {
    title: 'Blocks',
    required: ['code', 'name', 'size_value', 'size_unit', 'status'],
    optional: ['soil_type', 'irrigation_type', 'notes'],
    description: 'Upload farm plots in one file. size_unit must be acres or hectares.',
    permission: 'farm.manage',
    endpoint: '/api/farm/import/blocks',
    sample: ['B01', 'North Block', 2.5, 'acres', 'active', 'loam', 'drip', ''],
  },
  crops: {
    title: 'Crops',
    required: ['code', 'name', 'production_cycle', 'default_unit', 'status'],
    optional: ['scientific_name', 'maturity_days', 'description'],
    description: 'Upload crops in bulk. production_cycle: seasonal, annual, perennial, or continuous.',
    permission: 'crops.manage',
    endpoint: '/api/farm/import/crops',
    sample: ['CHILLI', 'Chilies', 'seasonal', 'kg', 'active', 'Capsicum annuum', 90, 'Hot pepper'],
  },
};

function ImportPage() {
  const { can } = useFarmAccess();
  const [kind, setKind] = useState<ImportKind>('workers');
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(
    null
  );

  const spec = SPECS[kind];
  const columns = useMemo(() => [...spec.required, ...spec.optional], [spec]);
  const missing = useMemo(
    () => spec.required.filter((h) => !headers.includes(h)),
    [headers, spec.required]
  );
  const canImport = can(spec.permission);

  const resetFile = () => {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setHeaderError(null);
    setResult(null);
  };

  const onFile = async (file: File | null) => {
    setResult(null);
    setHeaderError(null);
    setRows([]);
    setHeaders([]);
    setFileName(null);
    if (!file) return;
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.headers.length || parsed.rows.length === 0) {
        setHeaderError('File needs a header row and at least one data row.');
        return;
      }
      setHeaders(parsed.headers);
      setFileName(file.name);
      setRows(parsed.rows);
      const miss = SPECS[kind].required.filter((h) => !parsed.headers.includes(h));
      if (miss.length) {
        setHeaderError(`Missing required columns: ${miss.join(', ')}`);
      }
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'Could not read this file.');
    }
  };

  const buildPayload = () => {
    if (kind === 'workers') {
      return rows.map((r) => {
        const pay_basis = r.pay_basis as 'daily' | 'monthly';
        const daily = r.daily_rate ? Number(r.daily_rate) : null;
        const monthly = r.monthly_salary ? Number(r.monthly_salary) : null;
        return {
          worker_code: r.worker_code,
          full_name: r.full_name,
          phone: r.phone || null,
          national_id: r.national_id || null,
          category: r.category as 'permanent' | 'casual',
          job_role: r.job_role || null,
          status: (r.status || 'active') as 'active' | 'inactive' | 'terminated',
          start_date: r.start_date || null,
          pay_basis,
          daily_rate: pay_basis === 'daily' ? daily : null,
          monthly_salary: pay_basis === 'monthly' ? monthly : null,
          overtime_rate: r.overtime_rate ? Number(r.overtime_rate) : 0,
          notes: r.notes || null,
        };
      });
    }
    if (kind === 'blocks') {
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        size_value: Number(r.size_value),
        size_unit: r.size_unit as 'acres' | 'hectares',
        status: r.status as 'active' | 'preparation' | 'fallow' | 'inactive',
        soil_type: r.soil_type || null,
        irrigation_type: r.irrigation_type || null,
        notes: r.notes || null,
      }));
    }
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      scientific_name: r.scientific_name || null,
      production_cycle: r.production_cycle as 'seasonal' | 'annual' | 'perennial' | 'continuous',
      default_unit: r.default_unit as 'kg' | 'tonne' | 'crate' | 'bunch' | 'piece',
      maturity_days: r.maturity_days ? Number(r.maturity_days) : null,
      description: r.description || null,
      status: (r.status || 'active') as 'active' | 'inactive',
    }));
  };

  const runImport = async () => {
    if (missing.length || rows.length === 0 || !canImport) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await farmFetch<{ created: number; errors: { row: number; error: string }[] }>(spec.endpoint, {
        method: 'POST',
        body: { rows: buildPayload() },
      });
      setResult(res);
      toast.success(`Imported ${res.created} ${spec.title.toLowerCase()}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk upload"
        subtitle="Upload an Excel or CSV file to add many workers, blocks, or crops at once."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-brand-600" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Download the Excel template for the data you want to add.</p>
          <p>2. Fill in the rows in Excel, then save the file.</p>
          <p>3. Upload the file here and import.</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(SPECS) as ImportKind[]).map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={kind === k ? 'default' : 'outline'}
            onClick={() => {
              setKind(k);
              resetFile();
            }}
          >
            {SPECS[k].title}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="size-4 text-brand-600" /> {spec.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{spec.description}</p>
          <p className="text-xs text-muted-foreground">
            Required: <span className="font-mono">{spec.required.join(', ')}</span>
            {spec.optional.length ? (
              <>
                {' '}
                · Optional: <span className="font-mono">{spec.optional.join(', ')}</span>
              </>
            ) : null}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadImportTemplate(`${kind}-import-template`, columns, spec.sample, 'xlsx')}
            >
              <Download className="size-4" />
              Download Excel template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadImportTemplate(`${kind}-import-template`, columns, spec.sample, 'csv')}
            >
              <Download className="size-4" />
              Download CSV template
            </Button>
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[0.95rem] border border-dashed border-[rgb(46_94_74/0.25)] bg-[linear-gradient(180deg,#ffffff_0%,#f7faf8_100%)] px-4 py-8 text-center shadow-[var(--shadow-soft)] hover:border-[rgb(46_94_74/0.4)]">
            <Upload className="size-6 text-brand-700" />
            <span className="text-sm font-medium">{fileName ?? 'Choose an Excel or CSV file'}</span>
            <span className="text-xs text-muted-foreground">.xlsx, .xls, or .csv · up to 500 rows</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {headerError ? <p className="text-sm text-red-600">{headerError}</p> : null}
          {!headerError && rows.length > 0 ? (
            <p className="text-sm text-emerald-700">
              Headers look good · {rows.length} row{rows.length === 1 ? '' : 's'} ready
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !!headerError || rows.length === 0 || !canImport}
              onClick={() => void runImport()}
            >
              {busy ? 'Importing…' : `Import ${spec.title.toLowerCase()}`}
            </Button>
            {fileName ? (
              <Button type="button" variant="outline" disabled={busy} onClick={resetFile}>
                Clear file
              </Button>
            ) : null}
          </div>

          {!canImport ? (
            <p className="text-sm text-amber-700">You need permission to import {spec.title.toLowerCase()}.</p>
          ) : null}

          {result ? (
            <div className="rounded-lg border border-[rgb(46_94_74/0.12)] bg-[linear-gradient(180deg,#ffffff_0%,#f7faf8_100%)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]">
              <p>
                Created <strong>{result.created}</strong>
                {result.errors.length ? ` · ${result.errors.length} row error(s)` : ''}
              </p>
              {result.errors.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">
                  {result.errors.slice(0, 20).map((e) => (
                    <li key={`${e.row}-${e.error}`}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission={['admin.settings', 'workforce.manage', 'farm.manage', 'crops.manage']}>
      <ImportPage />
    </RequirePermission>
  );
}
