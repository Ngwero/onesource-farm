import * as XLSX from 'xlsx';
import { parseCsv, toCsv } from '@/lib/farm/csv';

export type SpreadsheetRow = Record<string, string>;

export function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function matrixToRows(matrix: string[][]): { headers: string[]; rows: SpreadsheetRow[] } {
  if (matrix.length < 2) {
    return { headers: [], rows: [] };
  }
  const headers = matrix[0].map(normalizeHeader);
  const rows = matrix
    .slice(1)
    .map((cells) => {
      const obj: SpreadsheetRow = {};
      headers.forEach((h, i) => {
        obj[h] = String(cells[i] ?? '').trim();
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((v) => v.length > 0));
  return { headers, rows };
}

function sheetToMatrix(sheet: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  return raw.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []));
}

/** Parse CSV or Excel (.xlsx / .xls) into normalized header + data rows. */
export async function parseSpreadsheetFile(file: File): Promise<{ headers: string[]; rows: SpreadsheetRow[] }> {
  const name = file.name.toLowerCase();
  const isExcel =
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type === 'application/vnd.ms-excel';

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const first = workbook.SheetNames[0];
    if (!first) return { headers: [], rows: [] };
    const sheet = workbook.Sheets[first];
    if (!sheet) return { headers: [], rows: [] };
    return matrixToRows(sheetToMatrix(sheet));
  }

  const text = await file.text();
  return matrixToRows(parseCsv(text));
}

/** Download a CSV template Excel can open, or a real .xlsx workbook. */
export function downloadImportTemplate(
  filenameBase: string,
  headers: string[],
  sampleRow?: (string | number | null | undefined)[],
  format: 'csv' | 'xlsx' = 'xlsx'
) {
  const rows = sampleRow ? [sampleRow] : [];
  if (format === 'csv') {
    const body = toCsv(headers, rows);
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...(sampleRow ? [sampleRow.map((v) => v ?? '')] : [])]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Import');
  XLSX.writeFile(book, `${filenameBase}.xlsx`);
}
