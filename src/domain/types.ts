export interface Dimensions {
  readonly w: number;
  readonly h: number;
}

export interface OutputTarget extends Dimensions {
  readonly label: string;
}

export interface Framing {
  readonly cx: number;
  readonly cy: number;
  readonly cropW: number;
  readonly cropH: number;
}

export type AdjustmentKey =
  | 'exposure' | 'highlights' | 'shadows' | 'whites' | 'blacks'
  | 'contrast' | 'curve' | 'blackLift' | 'highlightKnee'
  | 'temperature' | 'tint' | 'vibrance' | 'saturation'
  | 'shadowCool' | 'highlightWarm'
  | 'clarity' | 'sharpen' | 'bloom' | 'halation' | 'vignette' | 'aberration'
  | 'grainAmount' | 'grainSize' | 'grainRoughness' | 'grainColor'
  | 'highlightProtect';
export type Adjustment = Record<AdjustmentKey, number>;

export interface CropItem {
  readonly id: string;
  readonly file: File;
  readonly image: HTMLImageElement;
  readonly name: string;
  readonly frame: Framing | null;
  readonly adjust: Adjustment;
  readonly approved: boolean;
  readonly auto: boolean;
  readonly framedFor: string | null;
}

/**
 * Which contract the crop is being made against. `preset` is the output-first
 * workflow — a chosen size the crop must satisfy. `freeform` is a temporary
 * override where the crop's own pixels are the output, so the ratio is unlocked.
 * Stated outright rather than inferred from a missing size: "no target" and
 * "the target is whatever I cut" are different facts.
 */
export type CropMode = 'preset' | 'freeform';

export interface AppState {
  readonly target: OutputTarget;
  readonly items: readonly CropItem[];
  readonly activeIndex: number;
  readonly batch: boolean;
  readonly cropMode: CropMode;
  /** The preset suspended by Freeform, kept so turning it off restores it. */
  readonly previousTarget: OutputTarget | null;
}

export interface SavedSize extends Dimensions {
  readonly id: string;
  readonly name: string;
}

/** A size kept on the top bar. Identified by its pixels, not by its name. */
export interface PinnedSize extends Dimensions {
  readonly id: string;
  readonly name: string;
}

export interface Preset extends Dimensions {
  readonly id: string;
  readonly group: string;
  readonly name: string;
  readonly hot?: true;
  readonly keywords: readonly string[];
}

/**
 * Where a size came from. `format` is one of the four common shapes on the
 * picker's home: named like a preset, but not in the catalogue, so it is never
 * a recent and pinning it needs no name.
 */
export type SizeResultKind = 'preset' | 'saved' | 'custom' | 'ratio' | 'template' | 'whole' | 'format';

export interface SizeResult extends Dimensions {
  readonly kind: SizeResultKind;
  readonly key: string;
  readonly name: string;
  readonly detail: string;
  readonly section?: string;
  readonly id?: string;
  readonly savedId?: string;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';
/** Multiplier applied to the selected output shape. */
export type ExportScale = number;

export interface ExportOptions {
  readonly format: ExportFormat;
  readonly quality: number;
  readonly template: string;
  readonly label: string;
  readonly scale: ExportScale;
}

export interface FilenameContext extends Dimensions {
  readonly name: string;
  readonly index: number;
  readonly total: number;
  readonly ext: string;
  readonly label?: string;
}
