/** Pixel rectangle inside the source picture. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function toBlob(src: Blob | string): Promise<Blob> {
  return typeof src === "string" ? (await fetch(src)).blob() : src;
}

export async function imageSize(src: Blob | string): Promise<{ w: number; h: number }> {
  const bmp = await createImageBitmap(await toBlob(src));
  const size = { w: bmp.width, h: bmp.height };
  bmp.close();
  return size;
}

function draw(bmp: ImageBitmap, crop: CropRect, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Crop and downscale a picture into a WebP data URL small enough to live inside
 * a character or a pack (Safari < 17 can't encode WebP: JPEG then).
 */
export async function encodeImage(src: Blob | string, opts: { crop?: CropRect; maxEdge: number; quality?: number }): Promise<string> {
  const bmp = await createImageBitmap(await toBlob(src));
  const canvas = draw(bmp, opts.crop ?? { x: 0, y: 0, width: bmp.width, height: bmp.height }, opts.maxEdge);
  bmp.close();
  const webp = canvas.toDataURL("image/webp", opts.quality ?? 0.82);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

/** Downscale a picture before sending it to the image API as a reference. */
export async function shrinkForUpload(src: Blob | string, maxEdge = 1024): Promise<Blob> {
  const bmp = await createImageBitmap(await toBlob(src));
  if (Math.max(bmp.width, bmp.height) <= maxEdge && typeof src !== "string" && /png|jpeg|webp/.test(src.type)) {
    bmp.close();
    return src;
  }
  const canvas = draw(bmp, { x: 0, y: 0, width: bmp.width, height: bmp.height }, maxEdge);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.9));
}

/** Centre square of a picture, biased up a little so faces stay in frame. */
export function centreSquare(w: number, h: number): CropRect {
  const side = Math.min(w, h);
  return { x: (w - side) / 2, y: Math.max(0, (h - side) * 0.3), width: side, height: side };
}
