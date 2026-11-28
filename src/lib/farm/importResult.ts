import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/farm/http';

export type ImportRowError = { row: number; error: string };

export function importJson(
  created: string[],
  errors: ImportRowError[],
  emptyMessage = 'Nothing was imported.'
) {
  if (created.length === 0 && errors.length > 0) {
    throw new HttpError(emptyMessage, 400, {
      _: errors.map((e) => `Row ${e.row}: ${e.error}`).join('; '),
    });
  }
  return NextResponse.json({
    created: created.length,
    codes: created,
    errors,
  });
}

export function rowErrorMessage(error: { code?: string; message: string }, duplicateLabel: string) {
  if (error.code === '23505') return duplicateLabel;
  return error.message;
}
