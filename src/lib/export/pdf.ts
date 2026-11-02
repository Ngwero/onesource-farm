import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs/promises';
import type { Memo, BrandingSettings } from '@/types';
import { readFileOptional } from '@/lib/storage';
import {
  MEMO_VISION_STATEMENT,
  formatMemoDate,
  formatSignerLine,
  getCompanyContactLines,
} from '@/lib/memo/coverLetterDefaults';
import { getMemoBodyRowsForExport, memoDocumentTitle } from '@/lib/memo/leaveTemplate';
import {
  resolveSignatureForBlock,
  type SignatureRecordForDisplay,
} from '@/lib/memo/signatureBlocks';
import {
  workflowStepsForDocumentApprovals,
  type WorkflowTimelineStep,
} from '@/lib/memo/workflowTimelineTypes';
import {
  drawMemoEcopyWatermark,
  MEMO_ECOPY_WATERMARK_SUB,
} from '@/lib/export/pdfWatermark';

const BRAND_GREEN = '#2E5E4A';
const PDF_OWNER_PASSWORD =
  process.env.PDF_OWNER_PASSWORD || 'rukapay-ememo-system-owner-key';
const SLATE = '#64748B';
const LIGHT_BG = '#F8FAFC';
const BORDER_LIGHT = '#E2E8F4';

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 36;
const FOOTER_ZONE = 46;
const SCALE_CANDIDATES = [1, 0.92, 0.84, 0.76, 0.68, 0.6] as const;

type BodySectionLayout = {
  label: string;
  content: string;
  blockHeight: number;
  textHeight: number;
};

type MemoPdfLayout = {
  scale: number;
  contentWidth: number;
  metaRows: [string, string][];
  bodySections: BodySectionLayout[];
  headerHeight: number;
  metaRowHeight: number;
  titleSize: number;
  bodyFontSize: number;
};

async function resolveLogoBuffer(logoPath?: string): Promise<Buffer | null> {
  if (logoPath) {
    const buf = await readFileOptional(logoPath);
    if (buf) return buf;
  }
  try {
    return fs.readFile(path.join(process.cwd(), 'public', 'onesource-logo-white.png'));
  } catch {
    return null;
  }
}

function buildMetaRows(memo: Memo): [string, string][] {
  return (
    [
      ['FROM', memo.memo_from || ''],
      ['THRU', memo.memo_thru || ''],
      ['TO', memo.memo_to || ''],
      ['DATE', formatMemoDate(memo.memo_date)],
      ['SUBJECT', memo.subject || ''],
    ] as [string, string][]
  ).filter(([, value]) => value);
}

function measureTextHeight(
  text: string,
  width: number,
  fontSize: number
): number {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  doc.font('Helvetica').fontSize(fontSize);
  return doc.heightOfString(text, { width, lineGap: 1 });
}

function fixedChromeHeight(metaCount: number, scale: number, approvalRows: number): number {
  const rowHeight = 28 * scale;
  return (
    MARGIN +
    48 * scale +
    10 * scale +
    10 * scale +
    18 * scale +
    12 * scale +
    Math.ceil(metaCount / 2) * 26 * scale +
    6 * scale +
    12 * scale +
    Math.max(approvalRows, 1) * rowHeight +
    14 * scale +
    FOOTER_ZONE
  );
}

function buildLayout(memo: Memo, scale: number, approvalRows: number): MemoPdfLayout {
  const contentWidth = PAGE.width - MARGIN * 2;
  const metaRows = buildMetaRows(memo);
  const bodyFontSize = Math.max(6, 7.5 * scale);
  const sectionLabelH = 9;
  const sectionPad = 7;
  const sectionGap = 4;
  const textWidth = contentWidth - 24;

  const rawSections = getMemoBodyRowsForExport(memo).map(
    ([label, content]) => [label.toUpperCase(), content] as [string, string]
  );

  const naturalHeights = rawSections.map(([, content]) =>
    measureTextHeight(content, textWidth, bodyFontSize)
  );
  const naturalBodyTotal = naturalHeights.reduce(
    (sum, textH) => sum + sectionLabelH + sectionPad + textH + sectionGap,
    0
  );

  const availableBody = PAGE.height - fixedChromeHeight(metaRows.length, scale, approvalRows);
  const shrink =
    naturalBodyTotal > availableBody && naturalBodyTotal > 0
      ? availableBody / naturalBodyTotal
      : 1;

  const bodySections: BodySectionLayout[] = rawSections.map(([label, content], i) => {
    const textHeight = Math.max(8, naturalHeights[i] * shrink);
    const blockHeight = sectionLabelH + sectionPad + textHeight;
    return { label, content, blockHeight, textHeight };
  });

  return {
    scale,
    contentWidth,
    metaRows,
    bodySections,
    headerHeight: 48 * scale,
    metaRowHeight: 26 * scale,
    titleSize: Math.max(14, 17 * scale),
    bodyFontSize,
  };
}

function pickLayout(memo: Memo, approvalRows: number): MemoPdfLayout {
  const metaCount = buildMetaRows(memo).length;
  for (const scale of SCALE_CANDIDATES) {
    const layout = buildLayout(memo, scale, approvalRows);
    const bodyTotal = layout.bodySections.reduce(
      (sum, section) => sum + section.blockHeight + 4,
      0
    );
    if (fixedChromeHeight(metaCount, scale, approvalRows) + bodyTotal <= PAGE.height + 1) {
      return layout;
    }
  }
  return buildLayout(memo, SCALE_CANDIDATES[SCALE_CANDIDATES.length - 1], approvalRows);
}

export async function generateMemoPDF(
  memo: Memo,
  branding: BrandingSettings,
  workflowSteps: WorkflowTimelineStep[] = []
): Promise<Buffer> {
  const logoBuffer = await resolveLogoBuffer(branding.logo_path);
  const contactLines = getCompanyContactLines(branding);
  const companyName = (branding.company_name || 'ONESOURCE').toUpperCase();
  const approvalSteps = workflowStepsForDocumentApprovals(workflowSteps);
  const approvalRowCount = approvalSteps.length + 1;
  const layout = pickLayout(memo, approvalRowCount);

  const signatures = (memo.signature_records || []) as SignatureRecordForDisplay[];
  const preparedSig = resolveSignatureForBlock('prepared', signatures, memo);
  const signatureBuffers = new Map<string, Buffer>();

  async function cacheSignature(key: string, path?: string) {
    if (!path || signatureBuffers.has(key)) return;
    const buf = await readFileOptional(path);
    if (buf) signatureBuffers.set(key, buf);
  }

  await cacheSignature('prepared', preparedSig?.signature_path);
  for (let i = 0; i < approvalSteps.length; i++) {
    await cacheSignature(`step-${i}`, approvalSteps[i].signature_path);
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: true,
      bufferPages: true,
      ownerPassword: PDF_OWNER_PASSWORD,
      permissions: {
        printing: 'highResolution',
        modifying: false,
        annotating: false,
        fillingForms: false,
        documentAssembly: false,
      },
    });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const x = MARGIN;
    const contentWidth = layout.contentWidth;
    const pageWidth = PAGE.width;
    const pageHeight = PAGE.height;

    const headerY = MARGIN;
    doc.rect(x, headerY, contentWidth, layout.headerHeight).fill(BRAND_GREEN);

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, x + 10, headerY + 8, { height: layout.headerHeight - 16 });
      } catch {
        /* invalid image */
      }
    }

    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(Math.max(7, 8 * layout.scale));
    doc.text(companyName, x, headerY + 8, { width: contentWidth - 16, align: 'right' });
    doc.font('Helvetica').fontSize(Math.max(6, 6.5 * layout.scale));
    contactLines.forEach((line, i) => {
      doc.fillColor('#eef6e0').text(line, x, headerY + 18 + i * 8, {
        width: contentWidth - 16,
        align: 'right',
      });
    });

    let y = headerY + layout.headerHeight + 10;

    doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(Math.max(6, 6.5 * layout.scale));
    doc.text('OFFICIAL CORRESPONDENCE', x, y, { lineBreak: false });
    y += 10;

    doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(layout.titleSize);
    doc.text(memoDocumentTitle(memo), x, y, { width: contentWidth - 150, lineBreak: false });
    y += layout.titleSize + 4;

    if (memo.reference_number) {
      const refW = 128;
      const refX = pageWidth - MARGIN - refW;
      const refY = headerY + layout.headerHeight + 6;
      doc.roundedRect(refX, refY, refW, 24, 3).fill(LIGHT_BG);
      doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(5.5);
      doc.text('REFERENCE', refX + 6, refY + 4, { lineBreak: false });
      doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(6.5);
      doc.text(memo.reference_number, refX + 6, refY + 11, {
        width: refW - 12,
        height: 10,
        lineBreak: false,
      });
    }

    doc.moveTo(x, y).lineTo(x + contentWidth, y).strokeColor(BORDER_LIGHT).lineWidth(1).stroke();
    y += 10;

    const colW = (contentWidth - 6) / 2;
    const metaY = y;
    layout.metaRows.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = x + col * (colW + 6);
      const by = metaY + row * layout.metaRowHeight;
      const boxW =
        label === 'SUBJECT' && i === layout.metaRows.length - 1 && layout.metaRows.length % 2 === 1
          ? contentWidth
          : colW;
      const boxH = layout.metaRowHeight - 2;

      doc.roundedRect(bx, by, boxW, boxH, 3).fill(LIGHT_BG);
      doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(6);
      doc.text(label, bx + 6, by + 4, { lineBreak: false });
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(Math.max(6.5, 7.5 * layout.scale));
      doc.text(value, bx + 6, by + 12, {
        width: boxW - 12,
        height: boxH - 14,
        lineGap: 0,
      });
    });
    y = metaY + Math.ceil(layout.metaRows.length / 2) * layout.metaRowHeight + 6;

    for (const section of layout.bodySections) {
      doc.roundedRect(x, y, contentWidth, section.blockHeight, 3).fillAndStroke('#ffffff', BORDER_LIGHT);
      doc.rect(x, y, 2, section.blockHeight).fill(BRAND_GREEN);
      doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(Math.max(6, 6.5 * layout.scale));
      doc.text(section.label, x + 10, y + 5, { lineBreak: false });
      doc.fillColor('#334155').font('Helvetica').fontSize(layout.bodyFontSize);
      doc.text(section.content, x + 10, y + 13, {
        width: contentWidth - 20,
        height: section.textHeight,
        lineGap: 1,
      });
      y += section.blockHeight + 4;
    }

    doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(Math.max(6, 6.5 * layout.scale));
    doc.text('APPROVALS', x, y + 2, { lineBreak: false });
    y += 12;

    const rowH = 24 * layout.scale;
    const sigColW = 52 * layout.scale;
    const nameColX = x + contentWidth * 0.42;
    const sigColX = x + contentWidth - sigColW - 4;

    type PdfApprovalRow = {
      role: string;
      displayName?: string;
      signatureKey?: string;
    };

    const preparedDisplayName = preparedSig
      ? formatSignerLine(preparedSig.approver_name, preparedSig.approver_title)
      : memo.creator?.full_name
        ? formatSignerLine(memo.creator.full_name, memo.creator.title)
        : undefined;

    const pdfApprovalRows: PdfApprovalRow[] = [
      {
        role: 'PREPARED BY',
        displayName: preparedDisplayName,
        signatureKey: preparedSig?.signature_path ? 'prepared' : undefined,
      },
      ...approvalSteps.map((step, index) => ({
        role: step.name.toUpperCase(),
        displayName: step.approver,
        signatureKey: step.signature_path ? `step-${index}` : undefined,
      })),
    ];

    pdfApprovalRows.forEach((row) => {
      doc.roundedRect(x, y, contentWidth, rowH, 3).fillAndStroke('#ffffff', BORDER_LIGHT);
      doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(6);
      doc.text(row.role, x + 6, y + 4, {
        width: contentWidth * 0.38,
        lineBreak: false,
      });

      const nameLine = row.displayName || 'Pending';
      doc
        .fillColor(row.displayName ? '#0f172a' : SLATE)
        .font(row.displayName ? 'Helvetica-Bold' : 'Helvetica-Oblique')
        .fontSize(6);
      doc.text(nameLine, nameColX, y + 4, {
        width: sigColX - nameColX - 4,
        align: 'right',
        lineBreak: false,
      });

      const sigImg = row.signatureKey ? signatureBuffers.get(row.signatureKey) : undefined;
      if (sigImg) {
        try {
          doc.image(sigImg, sigColX, y + 4, { height: rowH - 8, width: sigColW });
        } catch {
          /* skip invalid image */
        }
      }

      y += rowH + 3;
    });

    y += 5;

    doc.fillColor(SLATE).font('Helvetica').fontSize(6);
    doc.text(MEMO_VISION_STATEMENT, x, y, {
      width: contentWidth,
      align: 'center',
      lineBreak: false,
    });

    doc.switchToPage(0);
    drawMemoEcopyWatermark(doc, pageWidth, pageHeight, MARGIN);

    doc.fontSize(6).fillColor(SLATE).font('Helvetica-Bold');
    doc.text(MEMO_ECOPY_WATERMARK_SUB, MARGIN, pageHeight - FOOTER_ZONE + 4, {
      align: 'center',
      width: contentWidth,
      lineBreak: false,
    });

    if (branding.confidentiality_notice) {
      doc.fontSize(6).fillColor(SLATE).font('Helvetica-Oblique');
      doc.text(branding.confidentiality_notice, MARGIN, pageHeight - FOOTER_ZONE + 14, {
        align: 'center',
        width: contentWidth,
        lineBreak: false,
      });
    }

    doc.end();
  });
}
