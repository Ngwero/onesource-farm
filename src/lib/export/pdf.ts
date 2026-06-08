import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs/promises';
import type { Memo, BrandingSettings, SignatureRecord } from '@/types';
import { readFile } from '@/lib/storage';
import {
  MEMO_VISION_STATEMENT,
  formatMemoDate,
  formatSignerLine,
  getCompanyContactLines,
} from '@/lib/memo/coverLetterDefaults';
import { getMemoBodyRowsForExport, memoDocumentTitle } from '@/lib/memo/leaveTemplate';
import { resolveSignatureForBlock } from '@/lib/memo/signatureBlocks';
import {
  drawMemoEcopyWatermark,
  MEMO_ECOPY_WATERMARK_SUB,
} from '@/lib/export/pdfWatermark';

const NAVY = '#001D6E';
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
    try {
      const { readFile } = await import('@/lib/storage');
      return readFile(logoPath);
    } catch {
      /* fall through */
    }
  }
  try {
    return fs.readFile(path.join(process.cwd(), 'public', 'rukapay-logo-white.png'));
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

function fixedChromeHeight(metaCount: number, scale: number): number {
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
    48 * scale +
    14 * scale +
    FOOTER_ZONE
  );
}

function buildLayout(memo: Memo, scale: number): MemoPdfLayout {
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

  const availableBody = PAGE.height - fixedChromeHeight(metaRows.length, scale);
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

function pickLayout(memo: Memo): MemoPdfLayout {
  const metaCount = buildMetaRows(memo).length;
  for (const scale of SCALE_CANDIDATES) {
    const layout = buildLayout(memo, scale);
    const bodyTotal = layout.bodySections.reduce(
      (sum, section) => sum + section.blockHeight + 4,
      0
    );
    if (fixedChromeHeight(metaCount, scale) + bodyTotal <= PAGE.height + 1) {
      return layout;
    }
  }
  return buildLayout(memo, SCALE_CANDIDATES[SCALE_CANDIDATES.length - 1]);
}

export async function generateMemoPDF(
  memo: Memo,
  branding: BrandingSettings,
  signatures: SignatureRecord[]
): Promise<Buffer> {
  const logoBuffer = await resolveLogoBuffer(branding.logo_path);
  const contactLines = getCompanyContactLines(branding);
  const companyName = (branding.company_name || 'RHINO PAYMENT SERVICES LIMITED').toUpperCase();
  const layout = pickLayout(memo);

  const enhancedSigs = new Map<string, Buffer>();
  const blocksToRender = ['prepared', 'checked', 'reviewed', 'approved'] as const;
  await Promise.all(
    blocksToRender.map(async (type) => {
      const sig = resolveSignatureForBlock(type, signatures, memo);
      if (!sig?.signature_path) return;
      const buf = await readFile(sig.signature_path);
      if (buf) enhancedSigs.set(type, buf);
    })
  );

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
    doc.rect(x, headerY, contentWidth, layout.headerHeight).fill(NAVY);

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
      doc.fillColor('#e8eeff').text(line, x, headerY + 18 + i * 8, {
        width: contentWidth - 16,
        align: 'right',
      });
    });

    let y = headerY + layout.headerHeight + 10;

    doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(Math.max(6, 6.5 * layout.scale));
    doc.text('OFFICIAL CORRESPONDENCE', x, y, { lineBreak: false });
    y += 10;

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(layout.titleSize);
    doc.text(memoDocumentTitle(memo), x, y, { width: contentWidth - 150, lineBreak: false });
    y += layout.titleSize + 4;

    if (memo.reference_number) {
      const refW = 128;
      const refX = pageWidth - MARGIN - refW;
      const refY = headerY + layout.headerHeight + 6;
      doc.roundedRect(refX, refY, refW, 24, 3).fill(LIGHT_BG);
      doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(5.5);
      doc.text('REFERENCE', refX + 6, refY + 4, { lineBreak: false });
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(6.5);
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
      doc.rect(x, y, 2, section.blockHeight).fill(NAVY);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(Math.max(6, 6.5 * layout.scale));
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

    const sigBlocks = [
      { label: 'Prepared', type: 'prepared' as const },
      { label: 'Checked', type: 'checked' as const },
      { label: 'Reviewed', type: 'reviewed' as const },
      { label: 'Approved', type: 'approved' as const },
    ];
    const cardW = (contentWidth - 12) / 4;
    const cardH = 48 * layout.scale;

    sigBlocks.forEach(({ label, type }, i) => {
      const sig = resolveSignatureForBlock(type, signatures, memo);
      const sigImg = sig?.signature_path ? enhancedSigs.get(type) : undefined;
      const cx = x + i * (cardW + 4);

      doc
        .roundedRect(cx, y, cardW, cardH, 3)
        .fillAndStroke(sig ? '#ffffff' : LIGHT_BG, sig ? NAVY : BORDER_LIGHT);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(6);
      doc.text(label.toUpperCase(), cx + 4, y + 4, { width: cardW - 8, lineBreak: false });

      if (sigImg) {
        try {
          doc.image(sigImg, cx + 4, y + 12, { height: 14, width: cardW - 8 });
        } catch {
          /* skip */
        }
      }

      const nameLine = sig
        ? formatSignerLine(sig.approver_name, sig.approver_title)
        : 'Pending';
      doc
        .fillColor(sig ? '#0f172a' : SLATE)
        .font(sig ? 'Helvetica-Bold' : 'Helvetica-Oblique')
        .fontSize(6);
      doc.text(nameLine, cx + 4, y + cardH - 11, {
        width: cardW - 8,
        height: 9,
        lineGap: 0,
      });
    });

    y += cardH + 8;

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
