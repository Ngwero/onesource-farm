import PDFDocument from 'pdfkit';

export const MEMO_ECOPY_WATERMARK_MAIN = 'E-COPY';
export const MEMO_ECOPY_WATERMARK_SUB =
  'ELECTRONIC COPY — OFFICIAL RECORD ONLY — NOT FOR EDITING';

const WATERMARK_NAVY = '#001D6E';

/** Diagonal watermark + corner tag on every exported memo page. */
export function drawMemoEcopyWatermark(
  doc: InstanceType<typeof PDFDocument>,
  pageWidth: number,
  pageHeight: number,
  margin: number
): void {
  const cx = pageWidth / 2;
  const cy = pageHeight / 2;

  doc.save();
  doc.opacity(0.1);
  doc.rotate(-38, { origin: [cx, cy] });
  doc.fillColor(WATERMARK_NAVY).font('Helvetica-Bold').fontSize(64);
  doc.text(MEMO_ECOPY_WATERMARK_MAIN, 0, cy - 36, {
    width: pageWidth,
    align: 'center',
  });
  doc.font('Helvetica').fontSize(11);
  doc.text(MEMO_ECOPY_WATERMARK_SUB, 0, cy + 28, {
    width: pageWidth,
    align: 'center',
  });
  doc.restore();

  const tagW = 118;
  const tagH = 22;
  const tagX = pageWidth - margin - tagW;
  const tagY = margin - 8;
  doc.save();
  doc.roundedRect(tagX, tagY, tagW, tagH, 3).fill('#f1f5f9');
  doc.fillColor(WATERMARK_NAVY).font('Helvetica-Bold').fontSize(7);
  doc.text(MEMO_ECOPY_WATERMARK_MAIN, tagX, tagY + 7, { width: tagW, align: 'center' });
  doc.restore();
}
