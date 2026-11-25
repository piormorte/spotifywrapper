import { PDFDocument } from 'pdf-lib';

/** A4 in PDF points. */
const A4 = [595.28, 841.89] as const;

/** Builds a PDF with one full-page PNG per page. */
export async function pngPagesToPdf(
  pages: readonly Uint8Array[],
  title: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('Liner');
  pdf.setProducer('Liner');
  for (const png of pages) {
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([A4[0], A4[1]]);
    page.drawImage(image, { x: 0, y: 0, width: A4[0], height: A4[1] });
  }
  return pdf.save();
}
