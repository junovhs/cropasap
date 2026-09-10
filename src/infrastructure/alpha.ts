// Whether a decoded image carries transparency, and whether what it does show
// is mostly light — the two facts that decide how it has to be presented.
//
// A white logo on a transparent ground is invisible on white paper, and just as
// invisible on the light half of a design app's checkerboard. So the probe
// reports lightness alongside alpha, and the stage picks a checker that the
// picture will actually read against.

export interface AlphaInfo {
  /** Any pixel is less than fully opaque. */
  readonly transparent: boolean;
  /** Of the pixels that are visible, most are light. */
  readonly light: boolean;
}

const OPAQUE: AlphaInfo = { transparent: false, light: false };
const PROBE_EDGE = 256;          // sampled at this size at most: a probe, not a render
const ALPHA_THRESHOLD = 250;     // below this an alpha value counts as see-through
const LIGHT_THRESHOLD = 0.68;    // mean luminance above which the picture is "light"

const cache = new WeakMap<HTMLImageElement, AlphaInfo>();

/** Probes once per image; every later call is a lookup. */
export function alphaOf(image: HTMLImageElement): AlphaInfo {
  const known = cache.get(image);
  if (known) return known;
  const info = probe(image);
  cache.set(image, info);
  return info;
}

function probe(image: HTMLImageElement): AlphaInfo {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return OPAQUE;
  const k = Math.min(1, PROBE_EDGE / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * k));
  const h = Math.max(1, Math.round(ih * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return OPAQUE;
  let data: Uint8ClampedArray;
  try {
    ctx.drawImage(image, 0, 0, w, h);
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return OPAQUE;                 // a tainted canvas cannot be read; assume opaque
  }
  let transparent = false;
  let lum = 0;
  let visible = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 255;
    if (a < ALPHA_THRESHOLD) transparent = true;
    if (a === 0) continue;
    const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
    lum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    visible++;
  }
  if (!transparent) return OPAQUE;
  return { transparent: true, light: visible > 0 && lum / visible > LIGHT_THRESHOLD };
}
