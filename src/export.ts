// Turning framings into files.

import { makeZip } from './zip.js';
import { encodePng } from './png.js';
import { resample } from './resample.js';
import { applyAdjustment, isNeutral } from './adjust.js';
import { canvasContext } from './infrastructure/dom.js';
import { decodeOriginal } from './infrastructure/image-decoder.js';
import type {
  CropItem,
  ExportFormat,
  ExportOptions,
  ExportScale,
  FilenameContext,
  OutputTarget,
} from './domain/types.js';

export interface FormatDescriptor {
  readonly mime: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly ext: 'png' | 'jpg' | 'webp';
  readonly label: string;
  readonly lossy: boolean;
  readonly alpha: boolean;
}

export const FORMATS: Readonly<Record<ExportFormat, FormatDescriptor>> = {
  png:  { mime: 'image/png',  ext: 'png',  label: 'PNG',  lossy: false, alpha: true },
  jpeg: { mime: 'image/jpeg', ext: 'jpg',  label: 'JPEG', lossy: true,  alpha: false },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', lossy: true,  alpha: true },
};

export const DEFAULT_TEMPLATE = '{name}-{w}x{h}';
export const SCALES: readonly ExportScale[] = [1, 2, 4];

export const scaledTarget = (target: OutputTarget, scale: ExportScale = 1): OutputTarget => ({
  ...target,
  w: Math.max(1, Math.round(target.w * scale)),
  h: Math.max(1, Math.round(target.h * scale)),
});

/**
 * The crop at its own resolution, as pixels we can do arithmetic on. Rounded
 * outward to whole pixels because a fractional source rectangle is a resample in
 * itself, and one done by the canvas in the wrong colour space at that.
 */
function cropPixels(
  item: CropItem,
  f: NonNullable<CropItem['frame']>,
  image: HTMLImageElement,
): ImageData | null {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const x = Math.max(0, Math.floor(f.cx - f.cropW / 2));
  const y = Math.max(0, Math.floor(f.cy - f.cropH / 2));
  const w = Math.min(iw - x, Math.max(1, Math.round(f.cropW)));
  const h = Math.min(ih - y, Math.max(1, Math.round(f.cropH)));
  if (w < 1 || h < 1) return null;

  const cut = document.createElement('canvas');
  cut.width = w;
  cut.height = h;
  const ctx = canvasContext(cut);
  ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Shrink in linear light when there is enough shrinking to be worth it. Returns
 * null whenever the good path does not apply — too little reduction to matter,
 * an upscale, or anything at all going wrong — and the caller falls back to the
 * canvas, which is what shipped before this and is no worse than it was.
 */
function resampled(
  item: CropItem,
  target: OutputTarget,
  image: HTMLImageElement,
): HTMLCanvasElement | null {
  const f = item.frame;
  if (!f) return null;
  if (f.cropW < target.w * 1.05 || f.cropH < target.h * 1.05) return null;
  try {
    const pixels = cropPixels(item, f, image);
    if (!pixels) return null;
    const done = resample(pixels, target.w, target.h);
    const canvas = document.createElement('canvas');
    canvas.width = target.w;
    canvas.height = target.h;
    canvasContext(canvas).putImageData(done, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/** Render one item at exactly the target pixel size. */
export function renderItem(
  item: CropItem,
  target: OutputTarget,
  format: ExportFormat,
  image = item.image,
): HTMLCanvasElement {
  const f = item.frame;
  if (!f) throw new Error(`Cannot export ${item.file.name}: no framing is available`);

  const fine = resampled(item, target, image);
  let src: CanvasImageSource = fine ?? image;
  let sx = fine ? 0 : f.cx - f.cropW / 2;
  let sy = fine ? 0 : f.cy - f.cropH / 2;
  let sw = fine ? target.w : f.cropW;
  let sh = fine ? target.h : f.cropH;

  while (sw > target.w * 2 && sh > target.h * 2) {
    const step = document.createElement('canvas');
    step.width = Math.max(1, Math.round(sw / 2));
    step.height = Math.max(1, Math.round(sh / 2));
    const sctx = canvasContext(step);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, sx, sy, sw, sh, 0, 0, step.width, step.height);
    src = step;
    sx = 0;
    sy = 0;
    sw = step.width;
    sh = step.height;
  }

  const out = document.createElement('canvas');
  out.width = target.w;
  out.height = target.h;
  const ctx = canvasContext(out);
  if (!FORMATS[format].alpha) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.w, target.h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, target.w, target.h);
  // The file always gets the real pipeline, at full output resolution, once.
  // `ctx.filter` can express five of the twenty-six controls, so using it here
  // because it was available meant grain, halation, bloom, vignette, clarity
  // and the tone curve were quietly missing from every export — the preview
  // showed one picture and the file was another.
  if (!isNeutral(item.adjust)) {
    const pixels = ctx.getImageData(0, 0, target.w, target.h);
    // Grain and the other radius effects are sized against the photograph, so
    // they are told how many output pixels one source pixel became.
    applyAdjustment(pixels, item.adjust, target.w / f.cropW);
    ctx.putImageData(pixels, 0, 0);
  }
  return out;
}

const EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const ENCODE_TIMEOUT = 20_000;

export function toBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const { mime, lossy, label } = FORMATS[format];
  return new Promise<Blob>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label} is not supported by this browser`)),
      ENCODE_TIMEOUT,
    );
    canvas.toBlob((blob) => {
      clearTimeout(timer);
      if (blob) resolve(blob);
      else reject(new Error(`Could not encode ${label}`));
    }, mime, lossy ? quality : undefined);
  });
}

export async function encode(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const blob = await toBlob(canvas, format, quality);
  if (format !== 'png') return blob;

  // PNG is lossless, so a smaller PNG of the same pixels is free money — but
  // only if it is actually smaller, which for a photograph it often is not.
  // Both are the same picture, so the choice can be made on size alone.
  const ours = await encodePng(canvasContext(canvas).getImageData(0, 0, canvas.width, canvas.height));
  return ours && ours.size < blob.size ? ours : blob;
}

export const sanitize = (value: string): string => value.replace(/[^\p{L}\p{N}._-]+/gu, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^[.-]+|[.-]+$/g, '') || 'image';

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

type FilenameToken = 'name' | 'n' | 'i' | 'w' | 'h' | 'size' | 'label' | 'date';

export function expandName(template: string, ctx: FilenameContext): string {
  const tokens: Record<FilenameToken, string> = {
    name: ctx.name,
    n: pad(ctx.index + 1, String(ctx.total).length),
    i: String(ctx.index + 1),
    w: String(ctx.w),
    h: String(ctx.h),
    size: `${ctx.w}x${ctx.h}`,
    label: ctx.label ?? '',
    date: new Date().toISOString().slice(0, 10),
  };
  const body = template.replace(/\{(\w+)\}/g, (whole: string, key: string) =>
    Object.hasOwn(tokens, key) ? tokens[key as FilenameToken] : whole);
  return `${sanitize(body)}.${ctx.ext}`;
}

/** Name every output uniquely, reserving original names before adding suffixes. */
export function unique(names: readonly string[]): string[] {
  const reserved = new Set(names.map((name) => name.toLowerCase()));
  const issued = new Set<string>();
  const suffixes = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    if (!issued.has(key)) {
      issued.add(key);
      return name;
    }
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : '';
    let suffix = suffixes.get(key) ?? 2;
    let candidate: string;
    do {
      candidate = `${stem}-${suffix++}${extension}`;
    } while (reserved.has(candidate.toLowerCase()) || issued.has(candidate.toLowerCase()));
    suffixes.set(key, suffix);
    issued.add(candidate.toLowerCase());
    return candidate;
  });
}

export interface ExportedFile {
  readonly name: string;
  readonly blob: Blob;
}

export type ExportProgress = (fraction: number) => void;

export async function buildFiles(
  items: readonly CropItem[],
  target: OutputTarget,
  options: ExportOptions,
  onProgress?: ExportProgress,
): Promise<ExportedFile[]> {
  const { format, quality, template, label, scale } = options;
  const out = scaledTarget(target, scale);
  const files: ExportedFile[] = [];

  for (const [index, item] of items.entries()) {
    const original = await decodeOriginal(item.file);
    let blob: Blob;
    try {
      const canvas = renderItem(item, out, format, original);
      blob = await encode(canvas, format, quality);
    } finally {
      original.src = '';
    }
    const ext = EXT_BY_MIME[blob.type] ?? FORMATS[format].ext;
    files.push({
      name: expandName(template, {
        name: item.name,
        index,
        total: items.length,
        w: out.w,
        h: out.h,
        ext,
        label,
      }),
      blob,
    });
    onProgress?.((index + 1) / items.length);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  const names = unique(files.map((file) => file.name));
  return files.map((file, index) => ({ ...file, name: names[index] ?? file.name }));
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

/**
 * How the files reach the person.
 *
 * On a phone a download lands in a Downloads folder, and getting a picture from
 * there into Photos is a detour. The system share sheet is where Photos lives -
 * "Save Image" on iOS, the gallery on Android - so on a touch device the files
 * go there instead, as images rather than a ZIP so the sheet can save them.
 * Share has to run inside the tap's activation window; if encoding took too
 * long and the browser refuses, the download happens as before.
 */
export type Delivery = 'downloaded' | 'shared' | 'cancelled';

const touchDevice = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** True where export will go to the share sheet rather than a download. */
export function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (!touchDevice() || typeof nav.share !== 'function' || !nav.canShare) return false;
  return nav.canShare({ files: [new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })] });
}

export async function deliver(
  files: readonly { readonly blob: Blob; readonly name: string }[],
  zipName: () => Promise<{ blob: Blob; name: string }>,
): Promise<{ delivery: Delivery; filename: string }> {
  const first = files[0];
  if (!first) throw new Error('Nothing to deliver');
  const shareable = files.map((file) => new File([file.blob], file.name, { type: file.blob.type }));
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (touchDevice() && typeof nav.share === 'function' && nav.canShare?.({ files: shareable })) {
    try {
      await nav.share({ files: shareable });
      return { delivery: 'shared', filename: files.length === 1 ? first.name : `${files.length} files` };
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { delivery: 'cancelled', filename: first.name };
      }
      // NotAllowedError (activation expired) or anything else: fall through.
    }
  }
  if (files.length === 1) {
    download(first.blob, first.name);
    return { delivery: 'downloaded', filename: first.name };
  }
  const zip = await zipName();
  download(zip.blob, zip.name);
  return { delivery: 'downloaded', filename: zip.name };
}

export interface ExportResult {
  readonly filename: string;
  readonly count: number;
  readonly delivery: Delivery;
}

export async function exportAll(
  items: readonly CropItem[],
  target: OutputTarget,
  options: ExportOptions,
  onProgress?: ExportProgress,
): Promise<ExportResult> {
  const files = await buildFiles(items, target, options, onProgress);
  if (!files.length) throw new Error('Nothing to export');
  const out = scaledTarget(target, options.scale);
  const { delivery, filename } = await deliver(files, async () => ({
    blob: await makeZip(files),
    name: `${sanitize(`cropasap ${options.label}`)}-${out.w}x${out.h}.zip`,
  }));
  return { filename, count: files.length, delivery };
}
