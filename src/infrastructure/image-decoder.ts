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

async function createPreviewElement(
  original: HTMLImageElement,
  size: SourceDimensions,
): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create image preview');

  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(original, {
        resizeWidth: size.width,
        resizeHeight: size.height,
        resizeQuality: 'high',
      });
    }
    context.drawImage(bitmap ?? original, 0, 0, size.width, size.height);
  } finally {
    bitmap?.close();
  }

  const blob = await canvasBlob(canvas);
  const url = URL.createObjectURL(blob);
  try {
    return await loadUrl(url, 'image preview');
  } finally {
    URL.revokeObjectURL(url);
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
  const original = await decodeOriginal(file);
  const source = sourceDimensions(original);
  const size = previewDimensions(source.width, source.height, maxEdge);
  if (size.width === source.width && size.height === source.height) return original;

  try {
    const preview = await createPreviewElement(original, size);
    sourceSizes.set(preview, source);
    return preview;
  } finally {
    // Drop the one large decoded surface before the next batch item starts.
    original.src = '';
  }
}

export const decodeEditingImage = (file: File): Promise<HTMLImageElement> =>
  decodeImage(file, EDIT_PREVIEW_MAX_EDGE);
