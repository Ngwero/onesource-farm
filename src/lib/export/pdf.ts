import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs/promises';
import type { Memo, BrandingSettings, SignatureRecord } from '@/types';
import { loadEnhancedSignature } from '@/lib/signature/enhance';
import {
  MEMO_VISION_STATEMENT,
  formatMemoDate,
  formatSignerLine,
  getCompanyContactLines,
} from '@/lib/memo/coverLetterDefaults';
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

export async function generateMemoPDF(
  memo: Memo,
  branding: BrandingSettings,
  signatures: SignatureRecord[]
): Promise<Buffer> {
  const logoBuffer = await resolveLogoBuffer(branding.logo_path);
  const contactLines = getCompanyContactLines(branding);
  const companyName = (branding.company_name || 'RHINO PAYMENT SERVICES LIMITED').toUpperCase();

  const enhancedSigs = new Map<string, Buffer>();
  const blocksToRender = ['prepared', 'checked', 'reviewed', 'approved'] as const;
  await Promise.all(
    blocksToRender.map(async (type) => {
      const sig = resolveSignatureForBlock(type, signatures, memo);
      if (!sig?.signature_path) return;
      const buf = await loadEnhancedSignature(sig.signature_path);
      if (buf) enhancedSigs.set(type, buf);
    })
  );

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const margin = 48;
    const doc = new PDFDocument({
      size: 'A4',
      margin,
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

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - margin * 2;
    const x = margin;

    const headerY = margin;
    const headerH = 62;
    doc.rect(x, headerY, contentWidth, headerH).fill(NAVY);

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, x + 12, headerY + 10, { height: 42 });
      } catch {
        /* invalid image */
      }
    }

    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
    doc.text(companyName, x, headerY + 10, { width: contentWidth - 20, align: 'right' });
    doc.font('Helvetica').fontSize(7);
    contactLines.forEach((line, i) => {
      doc.fillColor('#e8eeff').text(line, x, headerY + 22 + i * 9, {
        width: contentWidth - 20,
        align: 'right',
      });
    });

    let y = headerY + headerH + 20;

    doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(7);
    doc.text('OFFICIAL CORRESPONDENCE', x, y);
    y += 12;

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20);
    doc.text('Internal Memo', x, y);
    y += 26;

    if (memo.reference_number) {
      const refW = 140;
      const refX = pageWidth - margin - refW;
      const refY = headerY + headerH + 14;
      doc.roundedRect(refX, refY, refW, 28, 4).fill(LIGHT_BG);
      doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(6);
      doc.text('REFERENCE', refX + 8, refY + 6);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(7);
      doc.text(memo.reference_number, refX + 8, refY + 14, { width: refW - 16 });
    }

    doc.moveTo(x, y).lineTo(x + contentWidth, y).strokeColor(BORDER_LIGHT).lineWidth(1).stroke();
    y += 14;

    const metaRows: [string, string][] = [
      ['FROM', memo.memo_from || ''],
      ['THRU', memo.memo_thru || ''],
      ['TO', memo.memo_to || ''],
      ['DATE', formatMemoDate(memo.memo_date)],
      ['SUBJECT', memo.subject || ''],
    ].filter(([, v]) => v) as [string, string][];

    const colW = (contentWidth - 8) / 2;
    let metaY = y;
    metaRows.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = x + col * (colW + 8);
      const by = metaY + row * 34;
      const boxW = label === 'SUBJECT' && i === metaRows.length - 1 && metaRows.length % 2 === 1
        ? contentWidth
        : colW;
      const boxH = label === 'SUBJECT' ? 32 : 28;

      doc.roundedRect(bx, by, boxW, boxH, 3).fill(LIGHT_BG);
      doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(6.5);
      doc.text(label, bx + 8, by + 6);
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
      doc.text(value, bx + 8, by + 15, { width: boxW - 16, height: boxH - 18 });
    });
    y = metaY + Math.ceil(metaRows.length / 2) * 34 + 12;

    const sections: [string, string | undefined][] = [
      ['BACKGROUND', memo.background],
      ['FINANCIAL IMPLICATION', memo.financial_implication],
      ['JUSTIFICATION', memo.justification],
      ['RECOMMENDATION', memo.recommendation],
    ];

    for (const [label, content] of sections) {
      if (!content) continue;
      doc.font('Helvetica').fontSize(8.5);
      const textH = doc.heightOfString(content, { width: contentWidth - 24 });
      const blockH = textH + 28;
      doc.roundedRect(x, y, contentWidth, blockH, 4).fillAndStroke('#ffffff', BORDER_LIGHT);
      doc.rect(x, y, 3, blockH).fill(NAVY);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(7.5);
      doc.text(label, x + 12, y + 8);
      doc.fillColor('#334155').font('Helvetica').fontSize(8.5);
      doc.text(content, x + 12, y + 18, { width: contentWidth - 24, align: 'left' });
      y += blockH + 8;
    }

    doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(7);
    doc.text('APPROVALS', x, y + 4);
    y += 16;

    const sigBlocks = [
      { label: 'Prepared', type: 'prepared' as const },
      { label: 'Checked', type: 'checked' as const },
      { label: 'Reviewed', type: 'reviewed' as const },
      { label: 'Approved', type: 'approved' as const },
    ];
    const cardW = (contentWidth - 18) / 4;

    sigBlocks.forEach(({ label, type }, i) => {
      const sig = resolveSignatureForBlock(type, signatures, memo);
      const sigImg = sig?.signature_path ? enhancedSigs.get(type) : undefined;
      const cx = x + i * (cardW + 6);
      const cardH = 58;

      doc.roundedRect(cx, y, cardW, cardH, 4).fillAndStroke(sig ? '#ffffff' : LIGHT_BG, sig ? NAVY : BORDER_LIGHT);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(6.5);
      doc.text(label.toUpperCase(), cx + 6, y + 6, { width: cardW - 12 });

      if (sigImg) {
        try {
          doc.image(sigImg, cx + 6, y + 14, { height: 18, width: cardW - 12 });
        } catch {
          /* skip */
        }
      }

      const nameLine = sig
        ? formatSignerLine(sig.approver_name, sig.approver_title)
        : 'Pending';
      doc.fillColor(sig ? '#0f172a' : SLATE).font(sig ? 'Helvetica-Bold' : 'Helvetica-Oblique').fontSize(6.5);
      doc.text(nameLine, cx + 6, y + cardH - 12, { width: cardW - 12, height: 10 });
    });

    y += 68;

    doc.fillColor(SLATE).font('Helvetica').fontSize(6.5);
    doc.text(MEMO_VISION_STATEMENT, x, y, { width: contentWidth, align: 'center' });

    const pageCount = doc.bufferedPageRange().count;
    const pageHeight = doc.page.height;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      drawMemoEcopyWatermark(doc, pageWidth, pageHeight, margin);

      doc.fontSize(6).fillColor(SLATE).font('Helvetica-Bold');
      doc.text(MEMO_ECOPY_WATERMARK_SUB, margin, pageHeight - 48, {
        align: 'center',
        width: contentWidth,
      });

      if (branding.confidentiality_notice) {
        doc.fontSize(6).fillColor(SLATE).font('Helvetica-Oblique');
        doc.text(branding.confidentiality_notice, margin, pageHeight - 36, {
          align: 'center',
          width: contentWidth,
        });
      }
    }

    doc.end();
  });
}
