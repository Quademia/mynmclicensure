// lib/announcements/picture-maker.ts
//
// A notice's picture made on the admin's own computer before it is sent
// (08.10; Sam, 2026-10-18): uploaded only, never a link; wide. The chosen
// file is cut to the 2:1 shape students see (its middle) at up to 1200 ×
// 600 — never enlarged — and the list's square is that picture's middle
// at 160 × 160. Both as WebP; a browser that cannot make WebP (an older
// iPhone) makes JPEG instead. Nothing big leaves the computer: the opened
// notice's size is about 100 KB for a photo, the square about 10 KB.
// Browser only (canvas); no React.

export type MadePicture = {
  full: Blob;
  list: Blob;
  /** The files' kind: 'webp', or 'jpg' where WebP cannot be made. */
  ext: 'webp' | 'jpg';
  width: number;
  height: number;
};

export const PICTURE_MAX_FILE = 15 * 1024 * 1024; // what may be chosen; it is made small here

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      fail(new Error('not a picture'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((ok) => canvas.toBlob(ok, type, quality));
}

async function encode(canvas: HTMLCanvasElement, quality: number, ext: 'webp' | 'jpg'): Promise<Blob> {
  const blob = await toBlob(canvas, ext === 'webp' ? 'image/webp' : 'image/jpeg', quality);
  if (!blob) throw new Error('could not make the picture');
  return blob;
}

/** Cut, shrink and encode; throws when the file is not a picture this browser can read. */
export async function makePicture(file: File): Promise<MadePicture> {
  if (!file.type.startsWith('image/')) throw new Error('not a picture');
  if (file.size > PICTURE_MAX_FILE) throw new Error('too big');
  const img = await loadImage(file);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (!sw || !sh) throw new Error('not a picture');

  // the 2:1 middle of the picture
  let cw = sw;
  let ch = Math.round(sw / 2);
  if (ch > sh) {
    ch = sh;
    cw = sh * 2;
  }
  const cx = Math.round((sw - cw) / 2);
  const cy = Math.round((sh - ch) / 2);
  const width = Math.min(1200, cw);
  const height = Math.round(width / 2);

  const full = document.createElement('canvas');
  full.width = width;
  full.height = height;
  const fctx = full.getContext('2d');
  if (!fctx) throw new Error('could not make the picture');
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(img, cx, cy, cw, ch, 0, 0, width, height);

  // the list's square: the middle of what students see
  const list = document.createElement('canvas');
  list.width = 160;
  list.height = 160;
  const lctx = list.getContext('2d');
  if (!lctx) throw new Error('could not make the picture');
  lctx.imageSmoothingQuality = 'high';
  lctx.drawImage(full, Math.round((width - height) / 2), 0, height, height, 0, 0, 160, 160);

  // WebP where the browser makes it; else JPEG (the type it hands back says which)
  const probe = await toBlob(list, 'image/webp', 0.8);
  const ext: 'webp' | 'jpg' = probe && probe.type === 'image/webp' ? 'webp' : 'jpg';
  return {
    full: await encode(full, 0.8, ext),
    list: ext === 'webp' && probe ? probe : await encode(list, 0.8, ext),
    ext,
    width,
    height,
  };
}
