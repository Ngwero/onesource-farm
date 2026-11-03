'use client';

import { useMemo, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { farmFetch, errorMessage } from '@/lib/farm/client';
import { parseCsv } from '@/lib/farm/csv';

type ImportKind = 'workers' | 'blocks' | 'crops';

const SPECS: Record<
  ImportKind,
  { title: string; required: string[]; optional: string[]; description: string }
> = {
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
    description: 'Imports permanent/casual workers. daily_rate or monthly_salary must match pay_basis.',
  },
  blocks: {
    title: 'Blocks',
    required: ['code', 'name', 'size_value', 'size_unit', 'status'],
    optional: ['soil_type', 'irrigation_type', 'notes'],
    description: 'Header validation only for now — block import API comes next.',
  },
  crops: {
    title: 'Crops',
    required: ['code', 'name', 'production_cycle', 'default_unit', 'status'],
    optional: ['scientific_name', 'maturity_days', 'description'],
    description: 'Header validation only for now — crop import API comes next.',
  },
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

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
  const missing = useMemo(
    () => spec.required.filter((h) => !headers.includes(h)),
    [headers, spec.required]
  );

  const onFile = async (file: File | null) => {
    setResult(null);
    setHeaderError(null);
    setRows([]);
    setHeaders([]);
    setFileName(null);
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setHeaderError('CSV needs a header row and at least one data row.');
      return;
    }
    const hdrs = parsed[0].map(normalizeHeader);
    setHeaders(hdrs);
    setFileName(file.name);
    const data = parsed.slice(1).map((cells) => {
      const obj: Record<string, string> = {};
      hdrs.forEach((h, i) => {
        obj[h] = cells[i] ?? '';
      });
      return obj;
    });
    setRows(data);
    const miss = SPECS[kind].required.filter((h) => !hdrs.includes(h));
    if (miss.length) {
      setHeaderError(`Missing required columns: ${miss.join(', ')}`);
    }
  };

  const importWorkers = async () => {
    if (missing.length || rows.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const payload = rows.map((r) => {
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
      const res = await farmFetch<{ created: number; errors: { row: number; error: string }[] }>(
        '/api/farm/import/workers',
        { method: 'POST', body: { rows: payload } }
      );
      setResult(res);
      toast.success(`Imported ${res.created} worker${res.created === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CSV import"
        subtitle="Upload CSV files for blocks, crops, or workers. Headers are validated before import."
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(SPECS) as ImportKind[]).map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={kind === k ? 'default' : 'outline'}
            onClick={() => {
              setKind(k);
              setFileName(null);
              setHeaders([]);
              setRows([]);
              setHeaderError(null);
              setResult(null);
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

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center hover:bg-slate-50">
            <Upload className="size-6 text-brand-700" />
            <span className="text-sm font-medium">{fileName ?? 'Choose a CSV file'}</span>
            <span className="text-xs text-muted-foreground">UTF-8, comma-separated</span>
            <input
              type="file"
              accept=".csv,text/csv"
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

          {kind === 'workers' ? (
            <Button
              disabled={busy || !!headerError || rows.length === 0 || !can('workforce.manage')}
              onClick={() => void importWorkers()}
            >
              {busy ? 'Importing…' : 'Import workers'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Header check only — POST import for {spec.title.toLowerCase()} is not wired yet.
            </p>
          )}

          {result ? (
            <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
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
    <RequirePermission permission={['admin.settings', 'workforce.manage', 'farm.manage']}>
      <ImportPage />
    </RequirePermission>
  );
}
