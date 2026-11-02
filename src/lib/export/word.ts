import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
} from 'docx';
import type { Memo, BrandingSettings, SignatureRecord } from '@/types';
import {
  MEMO_VISION_STATEMENT,
  formatMemoDate,
  formatSignerLine,
  getCompanyContactLines,
} from '@/lib/memo/coverLetterDefaults';
import { getMemoBodyRowsForExport, memoDocumentTitle } from '@/lib/memo/leaveTemplate';
import { resolveSignatureForBlock } from '@/lib/memo/signatureBlocks';

const BRAND_GREEN = '2E5E4A';
const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 6, color: BRAND_GREEN },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_GREEN },
  left: { style: BorderStyle.SINGLE, size: 6, color: BRAND_GREEN },
  right: { style: BorderStyle.SINGLE, size: 6, color: BRAND_GREEN },
};

function labelCell(text: string) {
  return new TableCell({
    borders: cellBorder,
    width: { size: 18, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: BRAND_GREEN, size: 18 })],
      }),
    ],
  });
}

function valueCell(text: string) {
  return new TableCell({
    borders: cellBorder,
    width: { size: 82, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text, size: 17 })],
      }),
    ],
  });
}

function tableRow(label: string, value: string) {
  return new TableRow({ children: [labelCell(label), valueCell(value)] });
}

export async function generateMemoWord(
  memo: Memo,
  branding: BrandingSettings,
  signatures: SignatureRecord[]
): Promise<Buffer> {
  const contactLines = getCompanyContactLines(branding);
  const companyName = (branding.company_name || 'ONESOURCE FARM').toUpperCase();

  const metaRows = [
    ['From', memo.memo_from],
    ['Thru', memo.memo_thru],
    ['To', memo.memo_to],
    ['Date', formatMemoDate(memo.memo_date)],
    ['Subject', memo.subject],
  ].filter(([, v]) => v) as [string, string][];

  const bodyRows = getMemoBodyRowsForExport(memo);

  const sigBlocks = [
    { label: 'Prepared By', type: 'prepared' as const },
    { label: 'Checked By', type: 'checked' as const },
    { label: 'Reviewed By', type: 'reviewed' as const },
    { label: 'Approved By', type: 'approved' as const },
  ];

  const sigRows = sigBlocks.map(({ label, type }) => {
    const sig = resolveSignatureForBlock(type, signatures, memo);
    const text = sig ? formatSignerLine(sig.approver_name, sig.approver_title) : '';
    return tableRow(label, text);
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: MEMO_VISION_STATEMENT,
                size: 14,
                color: BRAND_GREEN,
                italics: true,
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: companyName, bold: true, size: 22, color: BRAND_GREEN }),
            ],
          }),
          ...contactLines.map(
            (line) =>
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: line, size: 16 })],
              })
          ),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: memoDocumentTitle(memo),
                size: 36,
                color: BRAND_GREEN,
                underline: {},
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: metaRows.map(([l, v]) => tableRow(l, v || '')),
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: bodyRows.map(([l, v]) => tableRow(l, v || '')),
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: sigRows,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: memo.reference_number ? `Ref: ${memo.reference_number}` : '',
                size: 14,
                color: '64748B',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: branding.confidentiality_notice || '',
                bold: true,
                size: 14,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
