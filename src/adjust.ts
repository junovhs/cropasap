// Image-adjustment domain and presentation adapter.

import type { Adjustment, AdjustmentKey } from './domain/types.js';

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
  channel('Effects', 'sharpen', 'Sharpen', 0, 100),
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

/**
 * A string that changes exactly when the look does. Caches keyed on this
 * redraw for grain and halation as readily as for contrast — which the CSS
 * filter string it replaced could not, because it never mentioned them.
 */
export const adjustSignature = (adjustment: Adjustment | null | undefined): string =>
  CHANNELS.map((entry) => adjustment?.[entry.key] ?? initialFor(entry)).join(',');

export const isNeutral = (adjustment: Adjustment | null | undefined): boolean =>
  !adjustment || CHANNELS.every((entry) => (adjustment[entry.key] ?? initialFor(entry)) === initialFor(entry));

const clampByte = (value: number): number => Math.max(0, Math.min(255, value));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (value: number): number => value * value * (3 - 2 * value);
const LUMA_R = 0.2126, LUMA_G = 0.7152, LUMA_B = 0.0722;
/** Display gamma. Exposure is the one control that has to be a light measurement
 *  rather than a number nudge, so it alone leaves sRGB and comes back. */
const GAMMA = 2.2;
const GLOW_THRESHOLD = 0.62;

/** Signed white noise, one value per grain cell. Mirrored exactly in the shader. */
const hash = (x: number, y: number, seed: number): number => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

/**
 * Every number the look actually needs, derived once from the slider values.
 *
 * The pixel loop below and the WebGL shader in `preview-gl.ts` both read this,
 * so a slider's meaning is decided in exactly one place. When the two renderers
 * disagree, it is because one of them stopped reading this — not because the
 * slider means two things.
 *
 * `scale` is render pixels per source pixel. Everything with a radius — the
 * grain cell, the sharpening and clarity taps, the colour fringe — is a
 * statement about the photograph, not about whatever resolution it is being
 * shown at, so those radii are multiplied through here. That is what makes the
 * preview and the exported file agree instead of merely resemble each other.
 */
export interface LookUniforms {
  readonly gain: number;
  readonly highlights: number;
  readonly shadows: number;
  readonly whites: number;
  readonly blacks: number;
  readonly blackLift: number;
  readonly contrast: number;
  readonly curve: number;
  readonly knee: number;
  readonly temperature: number;
  readonly tint: number;
  readonly vibrance: number;
  readonly saturation: number;
  readonly shadowCool: number;
  readonly highlightWarm: number;
  readonly clarity: number;
  readonly clarityRadius: number;
  readonly sharpen: number;
  readonly bloom: number;
  readonly halation: number;
  readonly vignette: number;
  readonly fringe: number;
  readonly grain: number;
  readonly grainCell: number;
  readonly grainRoughness: number;
  readonly grainColor: number;
  readonly highlightProtect: number;
}

export function lookUniforms(
  adjustment: Adjustment | null | undefined,
  scale = 1,
): LookUniforms {
  const value = { ...neutral(), ...(adjustment ?? {}) };
  const px = Math.max(0.05, scale);
  return {
    // ±100 is ±2 stops, which is the range a photograph can actually survive.
    gain: 2 ** (value.exposure / 50),
    highlights: value.highlights / 100,
    shadows: value.shadows / 100,
    whites: value.whites / 100,
    blacks: value.blacks / 100,
    blackLift: value.blackLift / 100,
    contrast: 1 + value.contrast / 100,
    curve: value.curve / 100,
    knee: value.highlightKnee / 100,
    temperature: value.temperature / 100,
    tint: value.tint / 100,
    vibrance: value.vibrance / 100,
    saturation: 1 + value.saturation / 100,
    shadowCool: value.shadowCool / 100,
    highlightWarm: value.highlightWarm / 100,
    clarity: value.clarity / 100,
    clarityRadius: Math.max(1, Math.round(3 * px)),
    sharpen: value.sharpen / 100,
    bloom: value.bloom / 100,
    halation: value.halation / 100,
    vignette: value.vignette / 100,
    fringe: Math.round(value.aberration / 100 * 3 * px),
    grain: value.grainAmount / 100,
    grainCell: Math.max(1, value.grainSize * px),
    grainRoughness: 0.35 + value.grainRoughness / 100 * 1.65,
    grainColor: value.grainColor / 100,
    highlightProtect: value.highlightProtect / 100,
  };
}

/** Whether the look needs a blurred copy of the picture to be rendered at all. */
export const needsGlow = (u: LookUniforms): boolean => u.bloom > 0 || u.halation > 0;

interface Glow {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly step: number;
}

/**
 * The bright parts of the picture, spread out.
 *
 * Bloom and halation are light escaping sideways, so what they need is a
 * genuinely blurred copy of the highlights — not a handful of taps at a fixed
 * offset, which is a ring rather than a glow. Built once per render at a
 * quarter resolution (blur is the one operation that costs nothing to do small)
 * and box-blurred twice, which is close enough to a Gaussian that no one can
 * tell and cheap enough to run on a phone.
 */
function buildGlow(source: Uint8ClampedArray, width: number, height: number): Glow {
  const step = 4;
  const gw = Math.max(1, Math.ceil(width / step));
  const gh = Math.max(1, Math.ceil(height / step));
  const bright = new Float32Array(gw * gh * 3);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      let r = 0, g = 0, b = 0, taken = 0;
      for (let dy = 0; dy < step; dy += 1) {
        const sy = gy * step + dy;
        if (sy >= height) break;
        for (let dx = 0; dx < step; dx += 1) {
          const sx = gx * step + dx;
          if (sx >= width) break;
          const at = (sy * width + sx) * 4;
          r += (source[at] ?? 0) / 255;
          g += (source[at + 1] ?? 0) / 255;
          b += (source[at + 2] ?? 0) / 255;
          taken += 1;
        }
      }
      const inv = taken ? 1 / taken : 0;
      r *= inv; g *= inv; b *= inv;
      const over = Math.max(0, LUMA_R * r + LUMA_G * g + LUMA_B * b - GLOW_THRESHOLD);
      const at = (gy * gw + gx) * 3;
      bright[at] = r * over;
      bright[at + 1] = g * over;
      bright[at + 2] = b * over;
    }
  }

  const radius = 3;
  const scratch = new Float32Array(bright.length);
  const blur = (from: Float32Array, into: Float32Array, horizontal: boolean): void => {
    const span = radius * 2 + 1;
    for (let y = 0; y < gh; y += 1) {
      for (let x = 0; x < gw; x += 1) {
        let r = 0, g = 0, b = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const sx = horizontal ? Math.max(0, Math.min(gw - 1, x + k)) : x;
          const sy = horizontal ? y : Math.max(0, Math.min(gh - 1, y + k));
          const at = (sy * gw + sx) * 3;
          r += from[at] ?? 0; g += from[at + 1] ?? 0; b += from[at + 2] ?? 0;
        }
        const at = (y * gw + x) * 3;
        into[at] = r / span; into[at + 1] = g / span; into[at + 2] = b / span;
      }
    }
  };
  blur(bright, scratch, true);
  blur(scratch, bright, false);
  blur(bright, scratch, true);
  blur(scratch, bright, false);
  return { data: bright, width: gw, height: gh, step };
}

/**
 * Apply the complete still-photo look to pixels in place.
 *
 * This is the definition of what the sliders do. Exports and contact-sheet
 * thumbnails run it unconditionally: a CSS filter can express five of these
 * twenty-six controls, so letting it stand in for the pipeline meant grain,
 * halation, bloom, vignette, clarity and the tone curve were silently absent
 * from the file on every browser that had `ctx.filter` — which is all of them.
 */
export function applyAdjustment(
  pixels: ImageData,
  adjustment: Adjustment | null | undefined,
  scale = 1,
): void {
  if (isNeutral(adjustment)) return;
  const u = lookUniforms(adjustment, scale);
  const data = pixels.data;
  const width = pixels.width || Math.max(1, data.length / 4);
  const height = pixels.height || 1;
  const source = new Uint8ClampedArray(data);

  // Exposure is the same curve for every channel and every pixel, so the two
  // gamma round trips it costs are paid 256 times rather than once per subpixel.
  const exposed = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) exposed[i] = ((i / 255) ** GAMMA * u.gain) ** (1 / GAMMA);

  const glow = needsGlow(u) ? buildGlow(source, width, height) : null;
  const local = u.clarity !== 0 || u.sharpen !== 0;

  const sample = (x: number, y: number, component: number): number => {
    const sx = Math.max(0, Math.min(width - 1, x));
    const sy = Math.max(0, Math.min(height - 1, y));
    return source[(sy * width + sx) * 4 + component] ?? 0;
  };
  const sampleLuma = (x: number, y: number): number =>
    (LUMA_R * sample(x, y, 0) + LUMA_G * sample(x, y, 1) + LUMA_B * sample(x, y, 2)) / 255;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      // Colour fringing is a lens, so it happens to the light before anything
      // else does: the red and blue records are simply not in the same place.
      const r0 = u.fringe ? sample(x + u.fringe, y, 0) : source[at] ?? 0;
      const g0 = source[at + 1] ?? 0;
      const b0 = u.fringe ? sample(x - u.fringe, y, 2) : source[at + 2] ?? 0;

      let r = exposed[r0] ?? 0;
      let g = exposed[g0] ?? 0;
      let b = exposed[b0] ?? 0;
      let luminance = LUMA_R * r + LUMA_G * g + LUMA_B * b;

      const shadows = u.shadows * (1 - luminance) ** 2 * 0.55;
      const highlights = u.highlights * luminance ** 2 * 0.55;
      const whites = u.whites * luminance ** 4 * 0.38;
      const blacks = u.blacks * (1 - luminance) ** 4 * 0.38;
      const light = shadows + highlights + whites + blacks + u.blackLift * 0.15;
      r += light; g += light; b += light;

      r = (r - 0.5) * u.contrast + 0.5;
      g = (g - 0.5) * u.contrast + 0.5;
      b = (b - 0.5) * u.contrast + 0.5;
      if (u.curve) {
        r += (smoothstep(clamp01(r)) - r) * u.curve;
        g += (smoothstep(clamp01(g)) - g) * u.curve;
        b += (smoothstep(clamp01(b)) - b) * u.curve;
      }
      if (u.knee) {
        const knee = u.knee * 0.7 * 3;
        r = r / (1 + Math.max(0, r - 0.62) * knee);
        g = g / (1 + Math.max(0, g - 0.62) * knee);
        b = b / (1 + Math.max(0, b - 0.62) * knee);
      }

      luminance = LUMA_R * r + LUMA_G * g + LUMA_B * b;
      const muted = 1 - clamp01(Math.max(r, g, b) - Math.min(r, g, b));
      const colorScale = u.saturation * (1 + u.vibrance * muted * 0.75);
      r = luminance + (r - luminance) * colorScale;
      g = luminance + (g - luminance) * colorScale;
      b = luminance + (b - luminance) * colorScale;
      r += u.temperature * 0.12 + u.tint * 0.06;
      g -= u.tint * 0.08;
      b -= u.temperature * 0.12 - u.tint * 0.06;
      const shadowMask = (1 - clamp01(luminance)) ** 2 * u.shadowCool;
      const highlightMask = clamp01(luminance) ** 2 * u.highlightWarm;
      r += highlightMask * 0.12; g += highlightMask * 0.045; b += shadowMask * 0.12;

      // Clarity and Sharpen are the same idea at two distances: both add back
      // what the neighbourhood average lost, one over a few pixels and one over
      // one, which is why they are worth having as separate controls.
      if (local) {
        const here = sampleLuma(x, y);
        let edge = 0;
        if (u.clarity) {
          const k = u.clarityRadius;
          const around = (sampleLuma(x - k, y) + sampleLuma(x + k, y)
            + sampleLuma(x, y - k) + sampleLuma(x, y + k)) * 0.25;
          edge += (here - around) * u.clarity * 0.9;
        }
        if (u.sharpen) {
          const around = (sampleLuma(x - 1, y) + sampleLuma(x + 1, y)
            + sampleLuma(x, y - 1) + sampleLuma(x, y + 1)) * 0.25;
          edge += (here - around) * u.sharpen * 1.4;
        }
        r += edge; g += edge; b += edge;
      }

      if (glow) {
        const gx = Math.max(0, Math.min(glow.width - 1, Math.floor(x / glow.step)));
        const gy = Math.max(0, Math.min(glow.height - 1, Math.floor(y / glow.step)));
        const gat = (gy * glow.width + gx) * 3;
        const glowR = glow.data[gat] ?? 0;
        const glowG = glow.data[gat + 1] ?? 0;
        const glowB = glow.data[gat + 2] ?? 0;
        // Bloom is white light spreading. Halation is the red one: on film it is
        // light that went through the emulsion, bounced off the backing and came
        // back, and it comes back red — so it is weighted, not tinted afterwards.
        r += glowR * u.bloom * 1.7 + glowR * u.halation * 2.6;
        g += glowG * u.bloom * 1.7 + glowG * u.halation * 0.7;
        b += glowB * u.bloom * 1.7 + glowB * u.halation * 0.25;
      }

      if (u.vignette) {
        const nx = width > 1 ? x / (width - 1) * 2 - 1 : 0;
        const ny = height > 1 ? y / (height - 1) * 2 - 1 : 0;
        const edge = clamp01((nx * nx + ny * ny - 0.18) / 1.45);
        const shade = u.vignette >= 0
          ? 1 - edge * u.vignette * 0.72
          : 1 - edge * u.vignette * 0.38;
        r *= shade; g *= shade; b *= shade;
      }

      if (u.grain) {
        const gx = Math.floor(x / u.grainCell), gy = Math.floor(y / u.grainCell);
        const protect = 1 - clamp01(luminance) * u.highlightProtect;
        const mono = hash(gx, gy, 1) * u.grain * u.grainRoughness * 0.12 * protect;
        const chroma = u.grainColor * u.grain * 0.055 * protect;
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
