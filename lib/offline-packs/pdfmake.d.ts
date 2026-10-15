// lib/offline-packs/pdfmake.d.ts — the little of pdfmake's browser build
// (0.3.11) that lib/offline-packs/pdf.ts calls. The package ships no types.

declare module 'pdfmake/build/pdfmake' {
  type FontFiles = { normal: string; bold: string; italics: string; bolditalics: string };
  type PdfDocument = {
    download(filename?: string): Promise<void>;
    getBlob(): Promise<Blob>;
  };
  const pdfMake: {
    addFonts(fonts: Record<string, FontFiles>): void;
    setUrlAccessPolicy(callback: (url: string) => boolean): void;
    createPdf(docDefinition: Record<string, unknown>): PdfDocument;
  };
  export default pdfMake;
}
