// Converting: changing the container, not the contents.
//
// Crop answers "what part of this, and how big?". Convert answers neither. It
// takes the pixels exactly as they arrived — every one of them, at the size they
// already are — and writes them into a different format. That restraint is the
// whole feature: the one thing a converter must never do is quietly resize or
// recompose what you gave it, because then you cannot tell whether the file got
// smaller because the format is better or because you lost half the picture.
//
// So this deliberately does not reuse `renderItem` from export.ts. That path
// crops to the frame, scales to a target and applies the adjustment, which are
// the three things that must not happen here. It shares the parts below the
// pixels instead — the encoders, the naming, the ZIP — because those are about
// files rather than about images.

import { searchSizeBudget } from './application/size-budget.js';
import { makeZip } from './zip.js';
import { FORMATS, deliver, encode, expandName, sanitize, toBlob, unique, type Delivery } from './export.js';
import { canvasContext } from './infrastructure/dom.js';
import { decodeOriginal, sourceDimensions } from './infrastructure/image-decoder.js';
import type { CropItem, ExportFormat } from './domain/types.js';

export interface ConvertOptions {
  readonly format: ExportFormat;
  readonly quality: number;
  readonly template: string;
  readonly targetBytes?: number;
  /** A file's own target when its row overrides the shared one. */
  readonly formatFor?: (item: CropItem) => ExportFormat;
}

/** What one file will be written as: its override, or the shared choice. */
export function planFor(item: CropItem, options: Pick<ConvertOptions, 'format' | 'targetBytes' | 'formatFor'>): {
  readonly format: ExportFormat;
  readonly targetBytes: number | undefined;
} {
  const format = options.formatFor?.(item) ?? options.format;
  // A size limit is a quality search, so it only means something to a lossy
  // target. A row overridden to PNG simply is not bound by it.
  return { format, targetBytes: FORMATS[format].lossy ? options.targetBytes : undefined };
}

export interface ConvertedFile {
  readonly name: string;
  readonly blob: Blob;
  /** What the source weighed, so the panel can report the trade honestly. */
  readonly fromBytes: number;
}

/**
 * The image on a canvas at its own natural size, ready to encode. Drawn 1:1, so
 * there is no resampling to get wrong — smoothing settings are irrelevant when
 * source and destination are the same rectangle.
 *
 * A format without an alpha channel gets white underneath first. Otherwise a
 * transparent PNG converted to JPEG comes out with black where the nothing was,
 * which is the canvas being literal about undefined pixels rather than anyone's
 * intent.
 */
export function surfaceOf(image: HTMLImageElement, format: ExportFormat): HTMLCanvasElement {
  const w = Math.max(1, image.naturalWidth);
  const h = Math.max(1, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvasContext(canvas);
  if (!FORMATS[format].alpha) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(image, 0, 0);
  return canvas;
}

/** An unmet budget never silently becomes an oversized download. */
export class SizeBudgetError extends Error {
  constructor(readonly smallestBytes: number, readonly quality: number, name: string, targetBytes: number) {
    super(`${name} cannot fit under ${readableBytes(targetBytes)} without resizing. Smallest found: ${smallestBytes.toLocaleString()} bytes at quality ${Math.round(quality * 100)}.`);
    this.name = 'SizeBudgetError';
  }
}

/**
 * One image, converted. The pixel dimensions of the result equal the source's.
 *
 * A canvas asked for a type it cannot write does not refuse — the spec has it
 * fall back to PNG, silently — so a browser without WebP would hand back a PNG
 * and everything downstream would carry on as though the request had been
 * honoured. Convert exists to change the format, so the one failure it must
 * never paper over is failing to change the format. PNG is exempt from the
 * check because our own encoder legitimately answers for it (PERF-01).
 */
export async function convertOne(
  item: CropItem,
  { format, quality, targetBytes }: Pick<ConvertOptions, 'format' | 'quality' | 'targetBytes'>,
  onProgress?: (fraction: number) => void,
  /**
   * An estimate rather than the file: skip our own PNG pass, which runs its
   * survey and filters on the main thread. The canvas PNG it would compete with
   * is the larger of the two, so the estimate is an upper bound, never a
   * flattering guess.
   */
  estimate = false,
): Promise<Blob> {
  if (targetBytes !== undefined && !FORMATS[format].lossy) {
    throw new Error('File size limits are available for JPEG and WebP');
  }
  const original = await decodeOriginal(item.file);
  // Decode off the main thread now, so the draw below is a copy rather than a
  // synchronous decode of every pixel in the middle of someone's click.
  await original.decode().catch(() => undefined);
  let surface: HTMLCanvasElement | undefined;
  let blob: Blob;
  try {
    const canvas = surfaceOf(original, format);
    surface = canvas;
    const encodeAtQuality = async (q: number): Promise<Blob> => {
      const encoded = estimate ? await toBlob(canvas, format, q) : await encode(canvas, format, q);
      const { mime, label } = FORMATS[format];
      if (format !== 'png' && encoded.type && encoded.type !== mime) {
        throw new Error(`This browser cannot write ${label}`);
      }
      return encoded;
    };
    if (targetBytes !== undefined) {
      const result = await searchSizeBudget(encodeAtQuality, targetBytes, onProgress);
      if (!result.met) throw new SizeBudgetError(result.blob.size, result.quality, item.file.name, targetBytes);
      blob = result.blob;
    } else {
      blob = await encodeAtQuality(quality);
    }
  } finally {
    original.src = '';
    if (surface) { surface.width = 0; surface.height = 0; }
  }
  return blob;
}

const EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export type ConvertProgress = (fraction: number) => void;

export async function convertAll(
  items: readonly CropItem[],
  options: ConvertOptions,
  onProgress?: ConvertProgress,
): Promise<ConvertedFile[]> {
  const files: ConvertedFile[] = [];

  for (const [index, item] of items.entries()) {
    const plan = planFor(item, options);
    const blob = await convertOne(
      item,
      { format: plan.format, quality: options.quality, targetBytes: plan.targetBytes },
      (fraction) => onProgress?.((index + fraction) / items.length),
    );
    const source = sourceDimensions(item.image);
    const ext = EXT_BY_MIME[blob.type] ?? FORMATS[plan.format].ext;
    files.push({
      name: expandName(options.template, {
        name: item.name,
        index,
        total: items.length,
        // The source's own dimensions, because they are what the file will
        // have. {w}x{h} in a Convert filename must not describe a crop target
        // the user is not using.
        w: source.width,
        h: source.height,
        ext,
        label: FORMATS[plan.format].label,
      }),
      blob,
      fromBytes: item.file.size,
    });
    onProgress?.((index + 1) / items.length);
    // The same yield the export path takes: a long queue must not lock the tab.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  const names = unique(files.map((file) => file.name));
  return files.map((file, index) => ({ ...file, name: names[index] ?? file.name }));
}

export interface ConvertResult {
  readonly filename: string;
  readonly count: number;
  readonly fromBytes: number;
  readonly toBytes: number;
  readonly delivery: Delivery;
}

const total = (files: readonly ConvertedFile[], of: (file: ConvertedFile) => number): number =>
  files.reduce((sum, file) => sum + of(file), 0);

export async function convertAndDownload(
  items: readonly CropItem[],
  options: ConvertOptions,
  onProgress?: ConvertProgress,
): Promise<ConvertResult> {
  const files = await convertAll(items, options, onProgress);
  const first = files[0];
  if (!first) throw new Error('Nothing to convert');

  const fromBytes = total(files, (file) => file.fromBytes);
  let zipSize = 0;
  const { delivery, filename } = await deliver(files, async () => {
    const zip = await makeZip(files);
    zipSize = zip.size;
    return { blob: zip, name: `${sanitize(`cropasap ${FORMATS[options.format].label}`)}.zip` };
  });
  // When a ZIP was written its own size is what landed, not the sum of what
  // went into it; shared or single files report the bytes themselves.
  const toBytes = zipSize || total(files, (file) => file.blob.size);
  return { filename, count: files.length, fromBytes, toBytes, delivery };
}

/**
 * Bytes as a person reads them. Kept to three significant figures at most,
 * because the fourth is never the point of the sentence it appears in.
 */
export function readableBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} KB`;
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}
