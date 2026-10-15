// lib/offline-packs/pdf.ts — View and Download PDF (07.5; Sam, 2026-10-15:
// pdfmake, on the phone). Browser only: the PDF is made on the student's phone from
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

async function makePdf(pack: Omit<PackPdf, 'markDataUrl'>) {
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
  return pdfMake.createPdf(packPdfDoc({ ...pack, markDataUrl: mark }, ownerPassword()));
}

/** Make the pack's PDF on this phone and hand it to the browser to save. */
export async function downloadPackPdf(pack: Omit<PackPdf, 'markDataUrl'>): Promise<void> {
  await (await makePdf(pack)).download(fileName(pack.packName));
}

/**
 * View (Sam, 2026-10-15: to read it without downloading, as the old print
 * page let you): a tab opened at the tap itself — a phone blocks one opened
 * seconds later, once the PDF is made — saying it is coming. Null when the
 * phone blocked it anyway.
 */
export function openViewTab(): Window | null {
  const win = window.open('', '_blank');
  if (!win) return null;
  try {
    win.document.title = 'Making your PDF…';
    win.document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:24px;color:#4b5563">Making your PDF…</p>';
  } catch {
    // the tab still receives the PDF
  }
  return win;
}

/**
 * Show the pack's PDF in the tab openViewTab opened. iPhones, computers and
 * newer Android Chrome show it on screen; an older Android browser saves it
 * and opens it in the phone's PDF app instead.
 */
export async function viewPackPdf(pack: Omit<PackPdf, 'markDataUrl'>, win: Window): Promise<void> {
  const blob = await (await makePdf(pack)).getBlob();
  win.location.href = URL.createObjectURL(blob);
}
