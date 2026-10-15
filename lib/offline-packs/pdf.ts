// lib/offline-packs/pdf.ts — Download PDF (07.5; Sam, 2026-10-15: pdfmake,
// on the phone). Browser only: the PDF is made on the student's phone from
// the pack's own questions, so nothing runs on our server for it.
//
// pdfmake (about 1 MB, 330 KB compressed) is fetched only when a student
// taps Download, and its font, Roboto, from the site itself (public/fonts,
// two files) — pdfmake may fetch nothing else. The painted Q is the 64px
// copy the top bar draws. The page description is pdf-doc.ts; the settings
// it locks (no copying, no editing) take a password made fresh for each file
// and never kept, so no one can unlock them.

import { packPdfDoc, type PackPdf } from './pdf-doc';

const MARK = '/images/quademia-mark-64.png';

function ownerPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function markDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch(MARK)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // the cover keeps its words without the Q
  }
}

/** A file name a phone keeps: the pack's name, then the product. */
function fileName(packName: string): string {
  const safe = packName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Offline pack';
  return `${safe} - MyNMCLicensure.pdf`;
}

/** Make the pack's PDF on this phone and hand it to the browser to save. */
export async function downloadPackPdf(pack: Omit<PackPdf, 'markDataUrl'>): Promise<void> {
  const [mod, mark] = await Promise.all([import('pdfmake/build/pdfmake'), markDataUrl()]);
  const pdfMake = (mod as { default?: typeof mod.default }).default ?? (mod as unknown as typeof mod.default);
  const fonts = `${window.location.origin}/fonts/`;
  pdfMake.setUrlAccessPolicy((url) => url.startsWith(fonts));
  pdfMake.addFonts({
    Roboto: {
      normal: `${fonts}Roboto-Regular.ttf`,
      bold: `${fonts}Roboto-Medium.ttf`,
      italics: `${fonts}Roboto-Regular.ttf`,
      bolditalics: `${fonts}Roboto-Medium.ttf`,
    },
  });
  await pdfMake.createPdf(packPdfDoc({ ...pack, markDataUrl: mark }, ownerPassword())).download(fileName(pack.packName));
}
