'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import {
  BULK_IMPORT_SPECS,
  buildImportPayload,
  columnsFor,
  friendlyColumns,
  type BulkImportKind,
} from '@/lib/farm/bulkImportCatalog';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { downloadImportTemplate, parseSpreadsheetFile } from '@/lib/farm/spreadsheet';

type Props = {
  kind: BulkImportKind;
  /** Compact layout for embedding under a list page. */
  className?: string;
};

export function BulkUploadCard({ kind, className }: Props) {
  const { can } = useFarmAccess();
  const queryClient = useQueryClient();
  const spec = BULK_IMPORT_SPECS[kind];
  const columns = useMemo(() => columnsFor(spec), [spec]);
  const canImport = can(spec.permission);

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(
    null
  );

  const missing = useMemo(
    () => spec.required.filter((h) => !headers.includes(h)),
    [headers, spec.required]
  );

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
      const miss = spec.required.filter((h) => !parsed.headers.includes(h));
      if (miss.length) {
        setHeaderError(`Missing required columns: ${miss.join(', ')}`);
      }
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'Could not read this file.');
    }
  };

  const runImport = async () => {
    if (missing.length || rows.length === 0 || !canImport) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await farmFetch<{ created: number; errors: { row: number; error: string }[] }>(spec.endpoint, {
        method: 'POST',
        body: { rows: buildImportPayload(kind, rows) },
      });
      setResult(res);
      for (const key of spec.invalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      toast.success(`Imported ${res.created} ${spec.title.toLowerCase()}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!canImport) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="size-4 text-brand-600" />
          Bulk upload — {spec.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{spec.description}</p>
        <p className="text-xs text-muted-foreground">
          Required: {friendlyColumns(spec.required)}
          {spec.optional.length ? <> · Optional: {friendlyColumns(spec.optional)}</> : null}
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
            Download CSV
          </Button>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[0.95rem] border border-dashed border-[rgb(46_94_74/0.25)] bg-[linear-gradient(180deg,#ffffff_0%,#f7faf8_100%)] px-4 py-6 text-center shadow-[var(--shadow-soft)] hover:border-[rgb(46_94_74/0.4)]">
          <Upload className="size-5 text-brand-700" />
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
            disabled={busy || !!headerError || rows.length === 0}
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
  );
}
