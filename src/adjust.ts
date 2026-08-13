// Image-adjustment domain and presentation adapter.

import type { Adjustment, AdjustmentKey } from './domain/types.js';
import { canvasContext } from './infrastructure/dom.js';

export type AdjustmentGroup = 'Light' | 'Tone' | 'Color' | 'Effects' | 'Grain';

export interface AdjustmentChannel {
  readonly key: AdjustmentKey;
  readonly label: string;
  readonly group: AdjustmentGroup;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly initial?: number;
}

const channel = (
  group: AdjustmentGroup,
  key: AdjustmentKey,
  label: string,
  min = -100,
  max = 100,
  step = 1,
  initial = 0,
): AdjustmentChannel => ({ group, key, label, min, max, step, initial });

export const CHANNELS: readonly AdjustmentChannel[] = [
  channel('Light', 'exposure', 'Exposure'),
  channel('Light', 'highlights', 'Highlights'),
  channel('Light', 'shadows', 'Shadows'),
  channel('Light', 'whites', 'Whites'),
  channel('Light', 'blacks', 'Blacks'),
  channel('Tone', 'contrast', 'Contrast'),
  channel('Tone', 'curve', 'S-curve', 0, 100),
  channel('Tone', 'blackLift', 'Black lift', 0, 100),
  channel('Tone', 'highlightKnee', 'Highlight rolloff', 0, 100),
  channel('Color', 'temperature', 'Temperature'),
  channel('Color', 'tint', 'Tint'),
  channel('Color', 'vibrance', 'Vibrance'),
  channel('Color', 'saturation', 'Saturation'),
  channel('Color', 'shadowCool', 'Cool shadows', 0, 100),
  channel('Color', 'highlightWarm', 'Warm highlights', 0, 100),
  channel('Effects', 'clarity', 'Clarity'),
  channel('Effects', 'bloom', 'Bloom', 0, 100),
  channel('Effects', 'halation', 'Halation', 0, 100),
  channel('Effects', 'vignette', 'Vignette'),
  channel('Effects', 'aberration', 'Color fringe', 0, 100),
  channel('Grain', 'grainAmount', 'Amount', 0, 100),
  channel('Grain', 'grainSize', 'Size', 1, 6, 0.1, 2),
  channel('Grain', 'grainRoughness', 'Roughness', 0, 100, 1, 45),
  channel('Grain', 'grainColor', 'Color', 0, 100),
  channel('Grain', 'highlightProtect', 'Highlight protect', 0, 100, 1, 60),
];

const initialFor = (entry: AdjustmentChannel): number => entry.initial ?? 0;

export const NEUTRAL: Readonly<Adjustment> = Object.freeze(
  Object.fromEntries(CHANNELS.map((entry) => [entry.key, initialFor(entry)])) as unknown as Adjustment,
);

export const neutral = (): Adjustment => ({ ...NEUTRAL });

export const isNeutral = (adjustment: Adjustment | null | undefined): boolean =>
  !adjustment || CHANNELS.every((entry) => (adjustment[entry.key] ?? initialFor(entry)) === initialFor(entry));

const clampByte = (value: number): number => Math.max(0, Math.min(255, value));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (value: number): number => value * value * (3 - 2 * value);
const hash = (x: number, y: number, seed: number): number => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

/** Apply the complete still-photo look to export/thumbnail pixels in place. */
export function applyAdjustment(pixels: ImageData, adjustment: Adjustment | null | undefined): void {
  if (isNeutral(adjustment)) return;
  const value = { ...neutral(), ...(adjustment ?? {}) };
  const data = pixels.data;
  const width = pixels.width || Math.max(1, data.length / 4);
  const height = pixels.height || 1;
  const source = new Uint8ClampedArray(data);
  const exposure = Math.max(0, 1 + value.exposure / 100);
  const contrast = 1 + value.contrast / 100;
  const saturation = 1 + value.saturation / 100;
  const vibrance = value.vibrance / 100;
  const temperature = value.temperature / 100;
  const tint = value.tint / 100;
  const clarity = value.clarity / 100;
  const bloom = value.bloom / 100;
  const halation = value.halation / 100;
  const fringe = Math.round(value.aberration / 25);
  const grain = value.grainAmount / 100;
  const grainCell = Math.max(1, Math.round(value.grainSize));
  const roughness = 0.35 + value.grainRoughness / 100 * 1.65;

  const sample = (x: number, y: number, component: number): number => {
    const sx = Math.max(0, Math.min(width - 1, x));
    const sy = Math.max(0, Math.min(height - 1, y));
    return source[(sy * width + sx) * 4 + component] ?? 0;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      let r = fringe ? sample(x + fringe, y, 0) : source[at] ?? 0;
      let g = source[at + 1] ?? 0;
      let b = fringe ? sample(x - fringe, y, 2) : source[at + 2] ?? 0;

      r = r / 255 * exposure;
      g = g / 255 * exposure;
      b = b / 255 * exposure;
      let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      const shadows = value.shadows / 100 * (1 - luminance) ** 2 * 0.55;
      const highlights = value.highlights / 100 * luminance ** 2 * 0.55;
      const whites = value.whites / 100 * luminance ** 4 * 0.38;
      const blacks = value.blacks / 100 * (1 - luminance) ** 4 * 0.38;
      const light = shadows + highlights + whites + blacks + value.blackLift / 100 * 0.15;
      r += light; g += light; b += light;

      r = (r - 0.5) * contrast + 0.5;
      g = (g - 0.5) * contrast + 0.5;
      b = (b - 0.5) * contrast + 0.5;
      const curve = value.curve / 100;
      if (curve) {
        r += (smoothstep(clamp01(r)) - r) * curve;
        g += (smoothstep(clamp01(g)) - g) * curve;
        b += (smoothstep(clamp01(b)) - b) * curve;
      }
      const knee = value.highlightKnee / 100 * 0.7;
      if (knee) {
        r = r / (1 + Math.max(0, r - 0.62) * knee * 3);
        g = g / (1 + Math.max(0, g - 0.62) * knee * 3);
        b = b / (1 + Math.max(0, b - 0.62) * knee * 3);
      }

      luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const muted = 1 - clamp01(max - min);
      const colorScale = saturation * (1 + vibrance * muted * 0.75);
      r = luminance + (r - luminance) * colorScale;
      g = luminance + (g - luminance) * colorScale;
      b = luminance + (b - luminance) * colorScale;
      r += temperature * 0.12 + tint * 0.06;
      g -= tint * 0.08;
      b -= temperature * 0.12 - tint * 0.06;
      const shadowMask = (1 - clamp01(luminance)) ** 2 * value.shadowCool / 100;
      const highlightMask = clamp01(luminance) ** 2 * value.highlightWarm / 100;
      r += highlightMask * 0.12; g += highlightMask * 0.045; b += shadowMask * 0.12;

      if (clarity) {
        const left = sample(x - 1, y, 1) / 255;
        const right = sample(x + 1, y, 1) / 255;
        const above = sample(x, y - 1, 1) / 255;
        const below = sample(x, y + 1, 1) / 255;
        const local = (left + right + above + below) * 0.25;
        const edge = (luminance - local) * clarity * 0.7;
        r += edge; g += edge; b += edge;
      }

      if (bloom || halation) {
        const radius = Math.max(2, Math.round(Math.min(width, height) / 180));
        let glowR = 0, glowG = 0, glowB = 0;
        for (const [dx, dy] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]] as const) {
          const sr = sample(x + dx, y + dy, 0) / 255;
          const sg = sample(x + dx, y + dy, 1) / 255;
          const sb = sample(x + dx, y + dy, 2) / 255;
          const bright = Math.max(0, 0.2126 * sr + 0.7152 * sg + 0.0722 * sb - 0.62);
          glowR += sr * bright; glowG += sg * bright; glowB += sb * bright;
        }
        r += glowR * bloom * 0.16 + glowR * halation * 0.14;
        g += glowG * bloom * 0.16 + glowG * halation * 0.035;
        b += glowB * bloom * 0.16;
      }

      const nx = width > 1 ? x / (width - 1) * 2 - 1 : 0;
      const ny = height > 1 ? y / (height - 1) * 2 - 1 : 0;
      const edge = clamp01((nx * nx + ny * ny - 0.18) / 1.45);
      const vignette = value.vignette / 100;
      const shade = vignette >= 0 ? 1 - edge * vignette * 0.72 : 1 - edge * vignette * 0.38;
      r *= shade; g *= shade; b *= shade;

      if (grain) {
        const gx = Math.floor(x / grainCell), gy = Math.floor(y / grainCell);
        const protect = 1 - clamp01(luminance) * value.highlightProtect / 100;
        const mono = hash(gx, gy, 1) * grain * roughness * 0.12 * protect;
        const chroma = value.grainColor / 100 * grain * 0.055 * protect;
        r += mono + hash(gx, gy, 2) * chroma;
        g += mono + hash(gx, gy, 3) * chroma;
        b += mono + hash(gx, gy, 4) * chroma;
      }

      data[at] = clampByte(r * 255);
      data[at + 1] = clampByte(g * 255);
      data[at + 2] = clampByte(b * 255);
    }
  }
}

/** Cheap compositor/canvas approximation used while a finger is moving. */
export function filterFor(adjustment: Adjustment | null | undefined): string {
  if (isNeutral(adjustment)) return 'none';
  const value = { ...neutral(), ...(adjustment ?? {}) };
  const brightness = Math.max(0.1, (1 + value.exposure / 100) * (1 + (value.shadows + value.whites) / 700));
  const contrast = Math.max(0.1, 1 + (value.contrast + value.curve + value.clarity * 0.45 - value.blackLift * 0.35) / 100);
  const saturation = Math.max(0, 1 + (value.saturation + value.vibrance * 0.7 + value.grainColor * 0.08) / 100);
  const hue = (value.tint - value.temperature + value.shadowCool * 0.2 - value.highlightWarm * 0.2) * 0.12;
  const sepia = Math.max(0, value.temperature + value.highlightWarm - value.shadowCool) / 500;
  return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturation.toFixed(3)}) hue-rotate(${hue.toFixed(2)}deg) sepia(${sepia.toFixed(3)})`;
}

export const CAN_FILTER = (() => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const context = canvasContext(canvas, { willReadFrequently: true });
    if (!('filter' in context)) return false;
    context.filter = 'invert(1)';
    context.fillStyle = '#000'; context.fillRect(0, 0, 1, 1);
    return (context.getImageData(0, 0, 1, 1).data[0] ?? 0) > 200;
  } catch { return false; }
})();

interface AdjustPanelOptions {
  readonly rows: HTMLElement;
  readonly reset: HTMLButtonElement;
  readonly onChange: (adjustment: Adjustment) => void;
  readonly onAnnounce?: (message: string) => void;
}

interface ChannelControls {
  readonly input: HTMLInputElement;
  readonly zero: HTMLButtonElement;
}

export interface AdjustPanel {
  load(adjustment: Adjustment | null | undefined): Adjustment;
  readonly enabled: boolean;
}

const displayValue = (entry: AdjustmentChannel, value: number): string => {
  if (entry.key === 'grainSize') return value.toFixed(1);
  return value > 0 && entry.min < 0 ? `+${value}` : String(value);
};

export function createAdjustPanel({ rows, reset, onChange, onAnnounce }: AdjustPanelOptions): AdjustPanel {
  let value = neutral();
  let changeFrame = 0;
  const controls = new Map<AdjustmentKey, ChannelControls>();
  const groups = new Map<AdjustmentGroup, HTMLDetailsElement>();

  const publish = (): void => {
    if (changeFrame) return;
    changeFrame = requestAnimationFrame(() => { changeFrame = 0; onChange(value); });
  };

  for (const groupName of ['Light', 'Tone', 'Color', 'Effects', 'Grain'] as const) {
    const details = document.createElement('details');
    details.className = 'adjust-group';
    details.open = groupName === 'Light';
    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.textContent = groupName;
    const touched = document.createElement('span');
    touched.className = 'adjust-group-count';
    touched.textContent = '0';
    summary.append(title, touched);
    const body = document.createElement('div');
    body.className = 'adjust-group-body';
    details.append(summary, body);
    rows.append(details);
    groups.set(groupName, details);
  }

  for (const entry of CHANNELS) {
    const row = document.createElement('div');
    row.className = 'adjust-row';
    row.dataset.channel = entry.key;
    const header = document.createElement('div');
    header.className = 'adjust-row-head';
    const id = `adj-${entry.key}`;
    const label = document.createElement('label');
    label.htmlFor = id; label.textContent = entry.label;
    const zero = document.createElement('button');
    zero.type = 'button'; zero.className = 'adjust-value'; zero.disabled = true;
    zero.title = `Reset ${entry.label.toLowerCase()}`;
    const input = document.createElement('input');
    input.type = 'range'; input.id = id;
    input.min = String(entry.min); input.max = String(entry.max); input.step = String(entry.step);
    input.value = String(initialFor(entry));
    input.addEventListener('input', () => {
      value = { ...value, [entry.key]: Number(input.value) };
      paint(); publish();
    });
    input.addEventListener('change', () => {
      if (changeFrame) { cancelAnimationFrame(changeFrame); changeFrame = 0; }
      onChange(value);
    });
    zero.addEventListener('click', () => {
      value = { ...value, [entry.key]: initialFor(entry) };
      paint(); onChange(value); onAnnounce?.(`${entry.label} reset`); input.focus();
    });
    header.append(label, zero); row.append(header, input);
    groups.get(entry.group)?.querySelector('.adjust-group-body')?.append(row);
    controls.set(entry.key, { input, zero });
  }

  reset.addEventListener('click', () => {
    value = neutral(); paint(); onChange(value); onAnnounce?.('Adjustments reset');
  });

  function paint(): void {
    const touchedByGroup = new Map<AdjustmentGroup, number>();
    for (const entry of CHANNELS) {
      const control = controls.get(entry.key);
      if (!control) continue;
      const current = value[entry.key] ?? initialFor(entry);
      if (Number(control.input.value) !== current) control.input.value = String(current);
      control.zero.textContent = displayValue(entry, current);
      const touched = current !== initialFor(entry);
      control.zero.disabled = !touched;
      if (touched) touchedByGroup.set(entry.group, (touchedByGroup.get(entry.group) ?? 0) + 1);
    }
    for (const [name, details] of groups) {
      const count = touchedByGroup.get(name) ?? 0;
      const badge = details.querySelector<HTMLElement>('.adjust-group-count');
      if (badge) { badge.textContent = String(count); badge.dataset.active = String(count > 0); }
    }
    reset.disabled = isNeutral(value);
  }

  return {
    load(adjustment): Adjustment {
      value = { ...neutral(), ...(adjustment ?? {}) };
      paint();
      return value;
    },
    enabled: true,
  };
}
