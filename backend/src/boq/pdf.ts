import { createRequire } from 'node:module';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { ApiError } from '../errors.js';
import type { Boq } from './repository.js';

const require = createRequire(import.meta.url);
const FONT_DIR = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONTS = { R: path.join(FONT_DIR, 'DejaVuSans.ttf'), B: path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'), I: path.join(FONT_DIR, 'DejaVuSans-Oblique.ttf') };

export const UNIT_LABELS: Record<string, string> = {
  m: 'm', m2: 'm²', m3: 'm³', sqft: 'sq ft', kg: 'kg', tonne: 'tonne', litre: 'litre', piece: 'piece', set: 'set', bag: 'bag', day: 'day', lump_sum: 'lump sum',
};

export const boqPdfFilename = (b: Pick<Boq, 'id' | 'revision'>) => `TenderLens-BOQ-${b.id.slice(0, 8)}-r${b.revision}.pdf`;

function numberFormat(currency: string, minFrac: number, maxFrac: number) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac });
}
// Intl.NumberFormat formats decimal STRINGS exactly (no float conversion) in Node >= 19.
const fmt = (nf: Intl.NumberFormat, v: string) => nf.format(v as unknown as number);

const clean = (s: string) => s.replace(/\r/g, '').replace(/\t/g, ' ');

/** Columns: No | Description | Qty | Unit | Rate | Amount (sums to the 515pt text width of an A4 page with 40pt margins). */
const COLS = [26, 198, 58, 48, 75, 110] as const;
const PAD = 4;

export interface RenderOptions { generatedAt?: Date; compress?: boolean }

export function renderBoqPdf(boq: Boq, opts: RenderOptions = {}): Promise<Buffer> {
  const generatedAt = opts.generatedAt ?? new Date();
  const doc = new PDFDocument({
    size: 'A4', margins: { top: 64, bottom: 64, left: 40, right: 40 }, bufferPages: true, compress: opts.compress ?? true,
    info: { Title: `Bill of Quantities - ${boq.title}`, Producer: 'TenderLens', Creator: 'TenderLens', CreationDate: generatedAt },
  });
  doc.registerFont('R', FONTS.R); doc.registerFont('B', FONTS.B); doc.registerFont('I', FONTS.I);

  // Refuse (rather than silently corrupt) text the embedded font cannot draw.
  doc.font('R');
  const fk = (doc as any)._font.font as { hasGlyphForCodePoint(cp: number): boolean };
  const fields: [string, string | null][] = [
    ['title', boq.title], ['description', boq.description], ['project name', boq.project.name], ['client name', boq.project.clientName],
    ['location', `${boq.project.location.city} ${boq.project.location.state} ${boq.project.location.postalCode ?? ''}`],
    ...boq.items.flatMap((i, n): [string, string | null][] => [[`item ${n + 1} description`, i.description], [`item ${n + 1} specifications`, i.specifications]]),
  ];
  const problems: { field: string; message: string }[] = [];
  for (const [name, value] of fields) {
    const bad = [...new Set([...(value ?? '')].filter((ch) => { const cp = ch.codePointAt(0)!; return cp > 0x20 && cp !== 0x7f && !fk.hasGlyphForCodePoint(cp); }))];
    if (bad.length) problems.push({ field: name, message: `Contains characters the PDF font cannot render: ${bad.slice(0, 8).join(' ')}` });
  }
  if (problems.length) {
    doc.end();
    throw new ApiError(422, 'UNSUPPORTED_CHARACTERS', 'The PDF cannot be generated because some text uses characters the document font does not support (e.g. Devanagari or CJK). Edit the highlighted fields to use supported characters.', problems.slice(0, 20));
  }

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });

  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
  const qtyNf = numberFormat(boq.currency, 0, 3);
  const moneyNf = numberFormat(boq.currency, 2, 2);
  const when = generatedAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

  const drawHeader = () => {
    doc.font('R').fontSize(8).fillColor('#64748b');
    doc.text('TenderLens · Bill of Quantities', L, 28, { width: W / 2, lineBreak: false });
    doc.text('DRAFT - not an approved or issued tender document', L + W / 2, 28, { width: W / 2, align: 'right', lineBreak: false });
    doc.moveTo(L, 44).lineTo(L + W, 44).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.fillColor('#0f172a'); doc.y = doc.page.margins.top;
  };
  drawHeader();
  doc.on('pageAdded', drawHeader);

  /* ---- Title block ---- */
  doc.font('B').fontSize(18).fillColor('#0f172a').text(clean(boq.title), L, doc.y, { width: W });
  doc.moveDown(0.4);
  const meta: [string, string][] = [
    ['Project', boq.project.name], ['Client / organization', boq.project.clientName],
    ['Location', [boq.project.location.city, boq.project.location.state, boq.project.location.postalCode].filter(Boolean).join(', ')],
    ['Currency', boq.currency], ['BOQ revision', String(boq.revision)], ['Generated', when],
  ];
  for (const [k, v] of meta) {
    const y = doc.y;
    doc.font('R').fontSize(9).fillColor('#64748b').text(k, L, y, { width: 130, lineBreak: false });
    doc.font('B').fontSize(9).fillColor('#0f172a').text(clean(v), L + 135, y, { width: W - 135 });
    doc.y = Math.max(doc.y, y + 13);
  }
  if (boq.description) {
    doc.moveDown(0.6);
    doc.font('B').fontSize(9).fillColor('#64748b').text('Scope of work', L, doc.y, { width: W });
    doc.font('R').fontSize(9.5).fillColor('#0f172a').text(clean(boq.description), L, doc.y + 2, { width: W });
  }
  doc.moveDown(1);

  /* ---- Table ---- */
  const xs = COLS.reduce<number[]>((acc, w, i) => { acc.push((acc[i] ?? L) + w); return acc; }, [L]);
  const drawTableHeader = () => {
    const y = doc.y;
    doc.rect(L, y, W, 20).fill('#eef1f8');
    doc.fillColor('#334155').font('B').fontSize(8);
    const heads = ['No.', 'Description', 'Qty', 'Unit', `Rate (${boq.currency})`, `Amount (${boq.currency})`];
    heads.forEach((h, i) => doc.text(h, xs[i]! + PAD, y + 6, { width: COLS[i]! - 2 * PAD, align: i >= 2 && i !== 3 ? 'right' : 'left', lineBreak: false }));
    doc.fillColor('#0f172a'); doc.y = y + 20;
  };

  const cellText = (text: string, x: number, y: number, w: number, align: 'left' | 'right', font: 'R' | 'B' = 'R', size = 8.5) => {
    let s = size; doc.font(font).fontSize(s);
    while (doc.widthOfString(text) > w && s > 5.5) { s -= 0.5; doc.fontSize(s); } // shrink numbers instead of wrapping/clipping
    doc.text(text, x, y, { width: w, align, lineBreak: false });
  };

  if (boq.items.length === 0) {
    drawTableHeader();
    doc.font('I').fontSize(9).fillColor('#64748b').text('This BOQ has no items yet.', L + PAD, doc.y + 8, { width: W });
    doc.fillColor('#0f172a'); doc.moveDown(1.5);
  } else {
    drawTableHeader();
    for (const it of boq.items) {
      const desc = clean(it.description);
      const spec = it.specifications ? clean(it.specifications) : null;
      doc.font('R').fontSize(9);
      const dH = doc.heightOfString(desc, { width: COLS[1] - 2 * PAD });
      doc.font('I').fontSize(8);
      const sH = spec ? doc.heightOfString(spec, { width: COLS[1] - 2 * PAD }) + 2 : 0;
      const rowH = Math.max(18, dH + sH + 2 * PAD);
      if (doc.y + rowH > bottomLimit()) { doc.addPage(); drawTableHeader(); } // header repeats on every page
      const y = doc.y;
      cellText(String(it.position), xs[0]! + PAD, y + PAD, COLS[0] - 2 * PAD, 'left');
      doc.font('R').fontSize(9).fillColor('#0f172a').text(desc, xs[1]! + PAD, y + PAD, { width: COLS[1] - 2 * PAD });
      if (spec) doc.font('I').fontSize(8).fillColor('#64748b').text(spec, xs[1]! + PAD, y + PAD + dH + 2, { width: COLS[1] - 2 * PAD });
      doc.fillColor('#0f172a');
      cellText(fmt(qtyNf, it.quantity), xs[2]! + PAD, y + PAD, COLS[2] - 2 * PAD, 'right');
      cellText(UNIT_LABELS[it.unit] ?? it.unit, xs[3]! + PAD, y + PAD, COLS[3] - 2 * PAD, 'left');
      cellText(it.estimatedRate === null ? '—' : fmt(moneyNf, it.estimatedRate), xs[4]! + PAD, y + PAD, COLS[4] - 2 * PAD, 'right');
      cellText(it.lineTotal === null ? '—' : fmt(moneyNf, it.lineTotal), xs[5]! + PAD, y + PAD, COLS[5] - 2 * PAD, 'right', 'B');
      doc.moveTo(L, y + rowH).lineTo(L + W, y + rowH).strokeColor('#e3e8f2').lineWidth(0.5).stroke();
      doc.y = y + rowH;
    }
  }

  /* ---- Total ---- */
  if (doc.y + 70 > bottomLimit()) doc.addPage();
  const ty = doc.y + 6;
  doc.rect(L, ty, W, 24).fill('#0f172a');
  doc.fillColor('#ffffff').font('B').fontSize(10);
  doc.text('Estimated total (base)', L + PAD * 2, ty + 7, { width: 250, lineBreak: false });
  doc.text(`${boq.currency} ${fmt(moneyNf, boq.total)}`, L + W - 260 - PAD * 2, ty + 7, { width: 260, align: 'right', lineBreak: false });
  doc.fillColor('#475569').font('R').fontSize(8);
  doc.y = ty + 32;
  const notes = ['Base total = sum of line totals (quantity × rate, each rounded half-up to 2 decimals). It excludes taxes, overheads, contingency and any other adjustments. Rates are estimates, not quotations.'];
  if (boq.unpricedItemCount > 0) notes.push(`${boq.unpricedItemCount} item(s) shown with "—" have no estimated rate yet and are not included in the total.`);
  for (const n of notes) { doc.text(n, L, doc.y, { width: W }); doc.moveDown(0.3); }

  /* ---- Footers with page numbers ---- */
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom; doc.page.margins.bottom = 0; // allow drawing in the bottom margin without auto page-add
    const fy = doc.page.height - 36;
    doc.font('R').fontSize(8).fillColor('#64748b');
    doc.text(`BOQ ${boq.id.slice(0, 8)} · revision ${boq.revision} · generated ${when}`, L, fy, { width: W - 90, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, L + W - 90, fy, { width: 90, align: 'right', lineBreak: false });
    doc.page.margins.bottom = keep;
  }
  doc.end();
  return done;
}
