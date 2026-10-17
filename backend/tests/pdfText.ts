// Independent PDF text extraction (pdfjs) used to verify generated documents' real content.
// @ts-ignore - no bundled types for the legacy build path
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function extractPages(buf: Buffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((i: any) => i.str).join(' '));
  }
  return pages;
}
