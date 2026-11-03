import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { csvResponse } from '@/lib/farm/csv';
import { HttpError } from '@/lib/farm/http';
import { buildReportCsv, canExportReport, isReportType } from '@/lib/farm/reports';

export async function GET(request: Request) {
  return withPermission('reports.export', async ({ can }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? '';
    const format = url.searchParams.get('format') ?? 'csv';
    if (!isReportType(type)) {
      throw new HttpError('Unknown report type. Use executive, activities, harvests, workers, stock, or shipments.', 400);
    }
    if (format !== 'csv') {
      throw new HttpError('Only CSV format is supported.', 400);
    }

    // Domain gates so export does not leak modules the user cannot open.
    const domainOk = canExportReport(type, can);
    if (!domainOk) {
      throw new HttpError('You do not have permission to export this report.', 403);
    }

    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { filename, csv } = await buildReportCsv(supabase, farmId, type, can);
    return csvResponse(filename, csv);
  });
}
