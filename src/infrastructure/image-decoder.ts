export const EDIT_PREVIEW_MAX_EDGE = 4096;
export const QUEUE_PREVIEW_MAX_EDGE = 1024;

export interface SourceDimensions {
  readonly width: number;
  readonly height: number;
}

const sourceSizes = new WeakMap<HTMLImageElement, SourceDimensions>();

function loadUrl(url: string, name: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not open ${name}`));
    image.src = url;
  });
}

/** Decode an original only for the short operation that needs every pixel. */
export async function decodeOriginal(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadUrl(url, file.name);
    sourceSizes.set(image, { width: image.naturalWidth, height: image.naturalHeight });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function previewDimensions(
  width: number,
  height: number,
  maxEdge = EDIT_PREVIEW_MAX_EDGE,
): SourceDimensions {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function sourceDimensions(image: HTMLImageElement): SourceDimensions {
  return sourceSizes.get(image) ?? { width: image.naturalWidth, height: image.naturalHeight };
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create image preview')));
  });
}

async function sourceToImage(
  source: CanvasImageSource,
  size: SourceDimensions,
): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create image preview');

  context.drawImage(source, 0, 0, size.width, size.height);

  const blob = await canvasBlob(canvas);
  const url = URL.createObjectURL(blob);
  try {
    return await loadUrl(url, 'image preview');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const JPEG_START = 0xffd8;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const JPEG_SIZE_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** Read JPEG/PNG dimensions from encoded headers without decoding their pixels. */
export function encodedImageDimensions(bytes: Uint8Array): SourceDimensions | null {
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value) && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (((bytes[0] ?? 0) << 8 | (bytes[1] ?? 0)) !== JPEG_START) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++] ?? 0;
    if (marker === 0xd8 || marker === 0x01) continue;
    if (marker === 0xd9 || marker === 0xda || offset + 1 >= bytes.length) break;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) break;
    // EXIF may rotate the decoded display relative to the stored SOF width and
    // height. Keep those files on the compatibility path unless/until their
    // orientation is parsed too; mismatched crop coordinates are worse than a
    // slower preview for this less common case.
    const exif = marker === 0xe1 && length >= 8
      && bytes[offset + 2] === 0x45 && bytes[offset + 3] === 0x78
      && bytes[offset + 4] === 0x69 && bytes[offset + 5] === 0x66
      && bytes[offset + 6] === 0 && bytes[offset + 7] === 0;
    if (exif) return null;
    if (JPEG_SIZE_MARKERS.has(marker) && length >= 7) {
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

async function encodedDimensions(file: File): Promise<SourceDimensions | null> {
  const limits = [64 * 1024, 256 * 1024, 1024 * 1024, 4 * 1024 * 1024];
  for (const limit of limits) {
    const length = Math.min(file.size, limit);
    const result = encodedImageDimensions(new Uint8Array(await file.slice(0, length).arrayBuffer()));
    if (result) return result;
    if (length === file.size) break;
  }
  return null;
}

async function directPreview(
  file: File,
  source: SourceDimensions,
  size: SourceDimensions,
): Promise<HTMLImageElement> {
  const bitmap = await createImageBitmap(file, {
    resizeWidth: size.width,
    resizeHeight: size.height,
    resizeQuality: 'high',
  });
  try {
    const preview = await sourceToImage(bitmap, size);
    sourceSizes.set(preview, source);
    return preview;
  } finally {
    bitmap.close();
  }
}

/**
 * Decode one queue item and immediately shed its full-resolution pixel buffer.
 * The returned image is screen-sized; sourceDimensions retains the coordinate
 * system used for framing and a fresh original is decoded only during export.
 */
export async function decodeImage(
  file: File,
  maxEdge = EDIT_PREVIEW_MAX_EDGE,
): Promise<HTMLImageElement> {
  // JPEG and PNG state their dimensions in a small header. Let createImageBitmap
  // decode directly to the bounded result so the browser never materialises the
  // enormous original merely to discover its size. This work is asynchronous,
  // leaving animation and modal input schedulable throughout preparation.
  if (typeof createImageBitmap === 'function') {
    const encoded = await encodedDimensions(file);
    if (encoded) {
      const bounded = previewDimensions(encoded.width, encoded.height, maxEdge);
      if (bounded.width !== encoded.width || bounded.height !== encoded.height) {
        return directPreview(file, encoded, bounded);
      }
    }
  }

  const original = await decodeOriginal(file);
  const source = sourceDimensions(original);
  const size = previewDimensions(source.width, source.height, maxEdge);
  if (size.width === source.width && size.height === source.height) return original;

  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(original, {
        resizeWidth: size.width,
        resizeHeight: size.height,
        resizeQuality: 'high',
      });
    }
    const preview = await sourceToImage(bitmap ?? original, size);
    sourceSizes.set(preview, source);
    return preview;
  } finally {
    bitmap?.close();
    // Drop the one large decoded surface before the next batch item starts.
    original.src = '';
  }
}

export const decodeEditingImage = (file: File): Promise<HTMLImageElement> =>
  decodeImage(file, EDIT_PREVIEW_MAX_EDGE);
