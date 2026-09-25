// The viewfinder.
//
// The frame is the direct manipulation surface. While you work, it can be moved
// and resized over the image like a conventional crop box. On release, the crop
// itself is kept exactly as chosen, then the frame glides back to the canonical
// centred output rectangle while the image is re-scaled and translated beneath
// it. The result is the familiar "draw the crop" gesture without leaving the
// workspace with a tiny, off-centre frame.
//
// The image outside the frame remains visible as a ghost, so moving or enlarging
// the crop always has spatial context. Wheel, pinch and the zoom control remain
// available as alternate ways to change the same persisted source rectangle.

import { Spring, createLoop, clamp } from './juice.js';
import { applyAdjustment, isNeutral, neutral } from './adjust.js';
import { createAdjustPreview } from './preview-gl.js';
import { resizeFree } from './application/freeform.js';
import { frameFit, type FrameView } from './application/frame-view.js';
import { handleAt, type FrameHandle } from './application/handles.js';
import { canvasContext } from './infrastructure/dom.js';
import { alphaOf } from './infrastructure/alpha.js';
import { sourceDimensions } from './infrastructure/image-decoder.js';
import type { Adjustment, Framing } from './domain/types.js';

// The CPU fallback preview, for a browser with no WebGL. The long side is not
// fixed: it starts modest and is nudged after every pass toward whatever this
// machine can do inside the budget, between these two ends.
const CPU_BUDGET = 60;  // ms of pixel work a moving slider can afford
const CPU_MIN = 320;
const CPU_MAX = 1400;
const CPU_START = 640;
const GHOST_IDLE = 0;         // at rest the discarded image is gone entirely
const GHOST_HOVER = 0.12;     // ...until the cursor is over it, then faintly back
const GHOST_ACTIVE = 0.34;    // ...and how much it lifts while you work
const GHOST_BEAT = 260;       // ms the lifted ghost holds after the frame lands
const CHECKER_CELL = 12;                          // CSS px per checker square
const CHECKER_LIGHT = ['#ffffff', '#d9dee6'];     // the design-app default
const CHECKER_DARK = ['#8a8f99', '#6e737d'];      // ...and the one a light picture needs
// The frame is drawn in the app's one accent, saffron (docs/design/voice.md).
// A crop frame has to read over whatever is in the photograph, and the commonest
// content — sky, water, foliage — is blue and green, where a blue frame vanished.
// A thin dark halo under every stroke carries it over snow and white skies too.
const FRAME = '#ffc21f';
const FRAME_LIVE = '#ffd76a';       // the edge under the pointer, a step brighter
const FRAME_HALO = 'rgba(0,0,0,0.55)';
const FRAME_PAD = 76;         // most breathing room between frame and stage edge
const FRAME_PAD_MIN = 22;     // ...and the least, once the stage is a phone
const FRAME_PAD_SHARE = 0.085; // in between, a share of the smaller dimension
// Extra room top and bottom on a narrow stage, where the tools and the readouts
// sit right on the picture and a frame paying no attention to them ends up
// underneath them.
const CHROME_PAD = 34;
const NARROW_STAGE = 620;
// Clear of the system's own edge-swipe strip, plus the reach around a handle.
const EDGE_GESTURE_PAD = 48;
const MAX_ZOOM = 8;           // relative to the minimum covering scale
// The floor is exactly "the picture covers the frame". Going below it was tried
// and taken back out: it made the frame bigger than the picture, which is a
// crop box that no longer describes a crop, and it quietly turned the export
// into a matte nobody asked for. Wanting a smaller *view* is a real wish, but
// it is a question about the frame's size on screen — which is what `frameView`
// answers — not about how much picture is behind it.
const MIN_ZOOM = 1;
const MIN_FRAME_PX = 44;       // smallest useful crop box on screen

export type { FrameView };

interface Point { readonly x: number; readonly y: number; }
interface FrameRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number; }
/** `pan` is the one gesture that moves the picture rather than the crop box. */
type DragKind = FrameHandle | 'pan';
interface DragState {
  readonly pointerId: number;
  readonly handle: DragKind;
  readonly from: Point;
  readonly frame: FrameRect;
}
interface PinchState { readonly dist: number; readonly mid: Point; }

export interface ViewfinderOptions {
  readonly canvas: HTMLCanvasElement;
  readonly stage: HTMLElement;
  readonly onFrameChange?: (framing: Framing) => void;
  /**
   * A freeform edit has been released. The crop is final; the caller decides
   * what output size it now stands for and sets it, which is what sends the
   * frame home through the ordinary recentre.
   */
  readonly onFreeformCommit?: (framing: Framing) => void;
}

export interface ViewfinderController {
  /** Shows the picture and ignores every pointer, for rooms that do not frame. */
  setLocked(locked: boolean): void;
  setImage(image: HTMLImageElement | null, framing?: Framing | null): void;
  setAdjust(adjustment: Adjustment): void;
  setTarget(w: number, h: number, immediate?: boolean): void;
  /** Unlock the frame's aspect. Everything else about the gesture is unchanged. */
  setFreeform(on: boolean): void;
  setFrameView(view: FrameView): void;
  getFrameView(): FrameView;
  getFrameScale(): number;
  canEnlarge(): boolean;
  /** Whether standing back would actually show you anything different. */
  canShrink(): boolean;
  getZoom(): number;
  getMaxZoom(): number;
  getMinZoom(): number;
  setZoom(zoom: number): void;
  nudge(dx: number, dy: number): void;
  zoomBy(factor: number): void;
  fill(): void;
  resize(): void;
  getFraming(): Framing;
  hasImage(): boolean;
}

export function createViewfinder(
  { canvas, stage, onFrameChange, onFreeformCommit }: ViewfinderOptions,
): ViewfinderController {
  const ctx = canvasContext(canvas);

  let image: HTMLImageElement | null = null;
  // Adjust and Convert leave the framing alone, so while one of them is the
  // job the stage shows the picture and takes no pointer at all.
  let locked = false;

  // The checkerboard a transparent picture sits on, the way a design app shows
  // one. Two boards: the usual light one, and a darker one for a picture that
  // is itself mostly light — a white logo vanishes into a white-and-grey board.
  const checkers = new Map<string, CanvasPattern>();
  function checker(dark: boolean): CanvasPattern | null {
    const key = `${dark}:${dpr}`;
    const known = checkers.get(key);
    if (known) return known;
    const cell = CHECKER_CELL * dpr;
    const tile = document.createElement('canvas');
    tile.width = tile.height = cell * 2;
    const t = tile.getContext('2d');
    if (!t) return null;
    const [a, b] = dark ? CHECKER_DARK : CHECKER_LIGHT;
    t.fillStyle = a;
    t.fillRect(0, 0, cell * 2, cell * 2);
    t.fillStyle = b;
    t.fillRect(0, 0, cell, cell);
    t.fillRect(cell, cell, cell, cell);
    const pattern = ctx.createPattern(tile, 'repeat');
    if (!pattern) return null;
    // The tile is in device pixels; the context draws in CSS pixels.
    pattern.setTransform(new DOMMatrix().scale(1 / dpr));
    checkers.set(key, pattern);
    return pattern;
  }
  // The look on the stage. `preview` is the GPU route — the same maths the file
  // gets, at frame rate. Where there is no WebGL the same pipeline runs on the
  // CPU into `slow`, at a resolution chosen so a dragging finger still gets
  // frames. There is no third route: an approximation that omits most of the
  // controls is not a preview of anything.
  const preview = createAdjustPreview();
  let adjustment: Adjustment = neutral();
  let previewDirty = true;
  let previewSource: HTMLCanvasElement | null = null;
  let slow: HTMLCanvasElement | null = null;
  let slowSource: HTMLImageElement | null = null;
  let cpuLong = CPU_START;
  let aspect = 1;
  // Freeform only changes what a resize is allowed to do. The frame is still
  // the thing being manipulated, and release still recentres.
  let freeform = false;
  let targetW = 1, targetH = 1;
  // DEC-03: the frame is the output at its real size on screen. `frameView` is
  // the explicit opt-out — closer for detail, further back for composition;
  // `frameScale` is how much of true size the frame is actually showing (below 1
  // means the stage forced a cap, or you asked to stand back).
  let frameView: FrameView = 'true';
  let frameScale = 1;
  // Whether either opt-out has anywhere to go. Once the stage is the limit,
  // enlarging offers nothing; once the frame is already small, so does shrinking.
  let enlargeable = false;
  let shrinkable = false;
  // The framing to hold on to while the frame itself is changing shape or size.
  let morph: Framing | null = null;
  let vw = 1, vh = 1, dpr = 1;
  let dragging: DragState | null = null;
  let hoverHandle: FrameHandle | null = null;
  const pointers = new Map<number, Point>();

  const frameX = new Spring(0, { stiffness: 210, damping: 24 });
  const frameY = new Spring(0, { stiffness: 210, damping: 24 });
  const frameW = new Spring(0, { stiffness: 210, damping: 24 });
  const frameH = new Spring(0, { stiffness: 210, damping: 24 });
  const scale = new Spring(1, { stiffness: 240, damping: 30 });
  const tx = new Spring(0, { stiffness: 240, damping: 30 });
  const ty = new Spring(0, { stiffness: 240, damping: 30 });
  const ghost = new Spring(GHOST_IDLE, { stiffness: 150, damping: 22, precision: 0.001 });
  const guides = new Spring(0, { stiffness: 180, damping: 24, precision: 0.001 });
  const springs = [frameX, frameY, frameW, frameH, scale, tx, ty, ghost, guides];

  const loop = createLoop((dt) => {
    let moving = false;
    for (const s of springs) moving = s.step(dt) || moving;
    // The frame's morph changes both what counts as legal and what the same
    // crop maps to on screen. Re-deriving the transform from the crop we started
    // with keeps the cut itself untouched while the frame grows or shrinks —
    // which is what makes switching between true size and fit a pure change of
    // magnification rather than a change of framing.
    const morphing = !frameX.settled || !frameY.settled || !frameW.settled || !frameH.settled;
    if (!dragging) {
      if (morph) {
        applyFraming(morph);
        if (!morphing) { morph = null; settle(); }
      } else if (morphing) settle();
    }
    tickRelease();
    draw();
    // Publish every frame, not just on release: the spring is what decides the
    // final crop, so anything that reads the framing must see where it landed.
    publish();
    return moving;
  });

  // ---- geometry ------------------------------------------------------------

  const frameRect = (): FrameRect => ({
    x: frameX.v,
    y: frameY.v,
    w: frameW.v,
    h: frameH.v,
  });

  function imageRect(): FrameRect {
    if (!image) return { x: 0, y: 0, w: 0, h: 0 };
    const source = sourceDimensions(image);
    return {
      x: tx.v,
      y: ty.v,
      w: source.width * scale.v,
      h: source.height * scale.v,
    };
  }

  // Air around the frame, as a share of the stage rather than a fixed number:
  // 76px is right beside a desktop stage and most of a phone.
  function framePad(): Point {
    const base = Math.min(FRAME_PAD, Math.max(FRAME_PAD_MIN, Math.min(vw, vh) * FRAME_PAD_SHARE));
    if (vw >= NARROW_STAGE) return { x: base, y: base };
    return {
      // iOS reads a drag begun within about 20px of the side as "go back", and
      // going back throws the work away. The frame — and the reach around its
      // handles, which extends outward — is kept clear of that strip, so no
      // grab starts in the zone the system has already claimed.
      x: Math.max(base, EDGE_GESTURE_PAD),
      // The tools and readouts sit right on the picture at this width.
      y: base + CHROME_PAD,
    };
  }

  function canonicalFrame(): FrameRect {
    const pad = framePad();
    const roomW = Math.max(40, vw - pad.x * 2);
    const roomH = Math.max(40, vh - pad.y * 2);
    const fit = frameFit(frameView, Math.min(roomW / targetW, roomH / targetH), Math.max(targetW, targetH));
    frameScale = fit.scale;
    enlargeable = fit.enlargeable;
    shrinkable = fit.shrinkable;
    const w = Math.max(8, targetW * frameScale);
    const h = Math.max(8, targetH * frameScale);
    return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
  }

  // Smallest scale at which the image still covers the frame. This is the floor
  // for every zoom: the frame is never allowed to contain empty space.
  function minScale(): number {
    if (!image) return 1;
    const source = sourceDimensions(image);
    return Math.max(frameW.v / source.width, frameH.v / source.height);
  }

  function bounds(): { readonly x: readonly [number, number]; readonly y: readonly [number, number] } {
    const current = image;
    if (!current) return { x: [0, 0], y: [0, 0] };
    const source = sourceDimensions(current);
    const f = frameRect();
    const s = scale.v;
    return {
      x: [f.x + f.w - source.width * s, f.x],
      y: [f.y + f.h - source.height * s, f.y],
    };
  }

  // True size by default: a 32x64 target is a 32x64 rectangle on screen, so the
  // smallness of a small crop is a fact you can see rather than a number you
  // have to imagine. Anything larger than the stage is capped down to fit, and
  // `frameScale` records by how much so the UI can say so.
  function layoutFrame(immediate = false): void {
    const next = canonicalFrame();
    if (immediate) {
      frameX.jump(next.x);
      frameY.jump(next.y);
      frameW.jump(next.w);
      frameH.jump(next.h);
    } else {
      frameX.set(next.x);
      frameY.set(next.y);
      frameW.set(next.w);
      frameH.set(next.h);
    }
  }

  // Nearest legal framing. Clamped only: the picture may not be dragged so far
  // that the frame would contain anything but picture. There is deliberately no
  // magnet at centre — a pull the pointer has to fight is a pull that has to
  // earn its keep, and dead centre is already reachable by double-click (which
  // fills) and preserved by every zoom, which works about the frame's centre.
  function legal(x: number, y: number): Point {
    const b = bounds();
    return { x: clamp(x, b.x[0], b.x[1]), y: clamp(y, b.y[0], b.y[1]) };
  }

  // Send the transform to its resting place. Called on pointer release, after a
  // zoom, and every frame the frame itself is still morphing.
  function settle(): void {
    if (!image) return;
    const min = minScale();
    if (scale.v < min * MIN_ZOOM) scale.set(min * MIN_ZOOM);
    // A magnet on exact fit, kept narrow: the zoom is a number you can set to
    // 101% on purpose now, and a wide magnet would quietly overrule you.
    else if (Math.abs(scale.v - min) / min < 0.004) scale.set(min);
    const l = legal(tx.v, ty.v);
    tx.set(l.x);
    ty.set(l.y);
    publish();
  }

  // A frame edit is committed by preserving the source rectangle currently
  // under it, then sending the frame back to the standard centred output size.
  // applyFraming() runs throughout that travel, so the crop is visually stable
  // while the image supplies the compensating zoom and translation.
  function normalizeFrame(): void {
    if (!image) return;
    morph = readFraming();
    layoutFrame(false);
    loop.kick();
  }

  // A new pointer can interrupt the return animation. Freeze the frame where it
  // is and keep the exact crop represented at that instant; otherwise a quick
  // second drag would fight springs that are still heading for the centre.
  function interruptMorph(): void {
    interruptTravel();
    if (!morph && frameX.settled && frameY.settled && frameW.settled && frameH.settled) return;
    const framing = image ? readFraming() : null;
    frameX.jump(frameX.v);
    frameY.jump(frameY.v);
    frameW.jump(frameW.v);
    frameH.jump(frameH.v);
    morph = null;
    if (framing) applyFraming(framing);
  }

  // The image springs travel on their own during a restore. A pointer that
  // arrives mid-flight takes the picture from where it is, not from where it
  // was heading.
  function interruptTravel(): void {
    for (const s of [scale, tx, ty]) if (!s.settled) s.jump(s.v);
  }

  // Wheel, pinch, keyboard and slider gestures operate on the image rather
  // than the crop box. If one begins while the frame is still returning home,
  // finish that return immediately while preserving the crop, then apply the
  // image gesture against the stable canonical frame.
  function normalizeFrameImmediately(): void {
    if (!image) return;
    interruptTravel();
    const home = canonicalFrame();
    const alreadyHome = !morph
      && Math.abs(frameX.v - home.x) < 0.01
      && Math.abs(frameY.v - home.y) < 0.01
      && Math.abs(frameW.v - home.w) < 0.01
      && Math.abs(frameH.v - home.h) < 0.01;
    if (alreadyHome) return;
    const framing = readFraming();
    morph = null;
    frameX.jump(home.x);
    frameY.jump(home.y);
    frameW.jump(home.w);
    frameH.jump(home.h);
    applyFraming(framing);
  }

  function publish(): void {
    if (!image || !onFrameChange) return;
    onFrameChange(readFraming());
  }

  // ---- framing, in source-image pixels -------------------------------------
  // Persisted per item so it survives resize, target changes and re-activation.

  function readFraming(): Framing {
    const f = frameRect();
    const s = scale.v;
    const cropW = f.w / s;
    const cropH = f.h / s;
    return {
      cx: (f.x - tx.v) / s + cropW / 2,
      cy: (f.y - ty.v) / s + cropH / 2,
      cropW,
      cropH,
    };
  }

  // Returns the framing actually put on screen — the requested one, re-fitted
  // and kept inside the picture. `animate` sends the image there by spring
  // instead of placing it: a restored crop should travel back the way it was
  // made, not appear.
  function applyFraming(framing?: Framing | null, animate = false): Framing | null {
    if (!image) return null;
    const f = frameRect();
    const { width: iw, height: ih } = sourceDimensions(image);
    // Re-fit the stored crop to the current aspect, keeping its centre. The crop
    // is never allowed out of the picture: a rectangle that reaches past the
    // edge is not a crop of anything.
    let cropW = framing ? framing.cropW : Math.min(iw, ih * aspect);
    let cropH = cropW / aspect;
    const fitting = Math.min(1, iw / cropW, ih / cropH);
    cropW *= fitting;
    cropH *= fitting;
    const cx = clamp(framing ? framing.cx : iw / 2, cropW / 2, iw - cropW / 2);
    const cy = clamp(framing ? framing.cy : ih / 2, cropH / 2, ih - cropH / 2);
    const s = f.w / cropW;
    const x = f.x - (cx - cropW / 2) * s;
    const y = f.y - (cy - cropH / 2) * s;
    if (animate) {
      scale.set(s);
      tx.set(x);
      ty.set(y);
    } else {
      scale.jump(s);
      tx.jump(x);
      ty.jump(y);
    }
    publish();
    return { cx, cy, cropW, cropH };
  }

  // ---- painting ------------------------------------------------------------

  function draw(): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Cleared rather than filled: the surround is the workspace's own paper,
    // showing through from the stage's CSS background. Painting a colour here
    // meant the canvas carried a second palette that had to be remembered
    // separately every time the theme moved — and didn't get remembered.
    // Cleared in device pixels: the backing store is rounded up from vw × dpr,
    // and a clear measured in CSS pixels can miss the last column.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (!image) return;

    // Geometry is always the photograph's. What gets painted may be a rendered
    // copy of it at a lower resolution, and the frame must not notice.
    const source = sourceDimensions(image);
    const w = source.width * scale.v;
    const h = source.height * scale.v;
    const f = frameRect();
    const paint = adjustedSource(image);

    // The adjustment rides on both passes, so the ghost you are cutting away is
    // the same picture as the one you are keeping. The chrome below is drawn
    // unfiltered — the frame is furniture, not part of the photograph.

    // 1. the whole image, faint — this is the part you are cutting away.
    // Clamped: the spring overshoots a little, and a negative alpha is not an
    // error but silently ignored, which painted the ghost at full strength.
    const ghostAlpha = Math.min(1, Math.max(0, ghost.v));
    if (ghostAlpha > 0) {
      ctx.globalAlpha = ghostAlpha;
      ctx.drawImage(paint, tx.v, ty.v, w, h);
      ctx.globalAlpha = 1;
    }

    // 2. the same image again at full strength, clipped to the frame. A
    // transparent picture gets its checkerboard first, only where the picture
    // itself is: the paper around it stays paper.
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.clip();
    const alpha = alphaOf(image);
    if (alpha.transparent) {
      const board = checker(alpha.light);
      if (board) {
        ctx.fillStyle = board;
        ctx.fillRect(tx.v, ty.v, w, h);
      }
    }
    ctx.drawImage(paint, tx.v, ty.v, w, h);
    ctx.restore();

    drawChrome(f);
  }

  /**
   * The picture to paint: the photograph with the look already on it. Rendered
   * only when something has actually changed — the spring loop runs at sixty
   * frames a second and the look does not.
   */
  function adjustedSource(photo: HTMLImageElement): CanvasImageSource {
    if (isNeutral(adjustment)) {
      previewSource = null;
      return photo;
    }
    if (previewDirty) {
      previewSource = preview
        ? preview.render(photo, adjustment)
        : renderOnCpu(photo);
      previewDirty = false;
    }
    return previewSource ?? photo;
  }

  /**
   * The same pipeline, in JavaScript, for a browser with no WebGL at all.
   *
   * The cost is per pixel and a dragging finger cannot wait, so the picture is
   * shrunk first — and by however much *this* machine turns out to need. The
   * long side is nudged after every pass toward whatever fits the frame budget,
   * so a slow phone settles small and a desktop settles large without either
   * being guessed at from a user agent string. Radius effects are told the
   * shrink, so grain stays grain-sized rather than becoming its own texture.
   */
  function renderOnCpu(photo: HTMLImageElement): HTMLCanvasElement | null {
    const source = sourceDimensions(photo);
    if (!source.width || !source.height) return null;
    const fit = Math.min(1, cpuLong / Math.max(source.width, source.height));
    const w = Math.max(1, Math.round(source.width * fit));
    const h = Math.max(1, Math.round(source.height * fit));
    slow ??= document.createElement('canvas');
    const into = canvasContext(slow, { willReadFrequently: true });
    if (slow.width !== w || slow.height !== h || slowSource !== photo) {
      slow.width = w;
      slow.height = h;
      slowSource = photo;
    }
    into.clearRect(0, 0, w, h);
    into.imageSmoothingEnabled = true;
    into.imageSmoothingQuality = 'high';
    into.drawImage(photo, 0, 0, w, h);
    const pixels = into.getImageData(0, 0, w, h);
    const started = performance.now();
    applyAdjustment(pixels, adjustment, w / source.width);
    const spent = performance.now() - started;
    into.putImageData(pixels, 0, 0);
    // Area is what costs, so the correction is on area: overrun shrinks by the
    // ratio it overran by, and a comfortable pass is allowed to grow back a
    // little. Both are clamped, so the size walks rather than oscillates.
    if (spent > CPU_BUDGET) {
      cpuLong = Math.max(CPU_MIN, Math.round(cpuLong * Math.max(0.6, (CPU_BUDGET / spent) ** 0.5)));
    } else if (spent < CPU_BUDGET * 0.4 && cpuLong < CPU_MAX) {
      cpuLong = Math.min(CPU_MAX, Math.round(cpuLong * 1.25));
    }
    return slow;
  }

  function drawChrome(f: FrameRect): void {
    // Thirds guides, present only while you are actually framing.
    if (guides.v > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${0.28 * guides.v})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(Math.round(f.x + (f.w * i) / 3) + 0.5, f.y);
        ctx.lineTo(Math.round(f.x + (f.w * i) / 3) + 0.5, f.y + f.h);
        ctx.moveTo(f.x, Math.round(f.y + (f.h * i) / 3) + 0.5);
        ctx.lineTo(f.x + f.w, Math.round(f.y + (f.h * i) / 3) + 0.5);
      }
      ctx.stroke();
    }

    // The frame edge itself: hairline, corner brackets, and short midpoint
    // grips. They are real controls now, so the same crop language that invites
    // the gesture is also the thing the pointer can actually move.
    const arm = Math.min(26, f.w / 5, f.h / 5);
    const corners = () => {
      ctx.beginPath();
      const cornerSpecs: readonly (readonly [number, number, number, number])[] = [
        [f.x, f.y, 1, 1], [f.x + f.w, f.y, -1, 1],
        [f.x, f.y + f.h, 1, -1], [f.x + f.w, f.y + f.h, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of cornerSpecs) {
        ctx.moveTo(cx + sx * arm, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * arm);
      }
      ctx.stroke();
    };

    // Locked, the frame is a boundary and not a control: a plain edge, no grips.
    if (locked) {
      ctx.strokeStyle = FRAME_HALO;
      ctx.lineWidth = 3;
      ctx.strokeRect(f.x, f.y, f.w, f.h);
      ctx.strokeStyle = FRAME;
      ctx.lineWidth = 1;
      ctx.strokeRect(f.x, f.y, f.w, f.h);
      return;
    }

    const mx = f.x + f.w / 2;
    const my = f.y + f.h / 2;
    const edgeArm = Math.min(24, Math.max(12, Math.min(f.w, f.h) / 5));
    const edgeBars = () => {
      ctx.beginPath();
      ctx.moveTo(mx - edgeArm / 2, f.y); ctx.lineTo(mx + edgeArm / 2, f.y);
      ctx.moveTo(mx - edgeArm / 2, f.y + f.h); ctx.lineTo(mx + edgeArm / 2, f.y + f.h);
      ctx.moveTo(f.x, my - edgeArm / 2); ctx.lineTo(f.x, my + edgeArm / 2);
      ctx.moveTo(f.x + f.w, my - edgeArm / 2); ctx.lineTo(f.x + f.w, my + edgeArm / 2);
      ctx.stroke();
    };

    // Halo first, one pass under everything, so the saffron always has an edge.
    ctx.lineCap = 'square';
    ctx.strokeStyle = FRAME_HALO;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.lineWidth = 6;
    corners();
    edgeBars();

    // Then the frame: a hairline edge, heavy corner brackets, short grips.
    ctx.strokeStyle = FRAME;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.lineWidth = 3.5;
    corners();
    edgeBars();

    // A tiny lift confirms which part of the frame is live without turning the
    // crop into a selection marquee.
    // 'pan' is excluded by name, not by luck: it contains an "n" and would
    // otherwise light the north edge every time you dragged the picture.
    const active = dragging?.handle ?? hoverHandle;
    if (active && active !== 'move' && active !== 'pan') {
      ctx.strokeStyle = FRAME_LIVE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (active.includes('n')) { ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.w, f.y); }
      if (active.includes('s')) { ctx.moveTo(f.x, f.y + f.h); ctx.lineTo(f.x + f.w, f.y + f.h); }
      if (active.includes('w')) { ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y + f.h); }
      if (active.includes('e')) { ctx.moveTo(f.x + f.w, f.y); ctx.lineTo(f.x + f.w, f.y + f.h); }
      ctx.stroke();
    }
  }

  // ---- interaction ---------------------------------------------------------

  const localPoint = (event: PointerEvent | WheelEvent): Point => {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  // Where the mouse last was over the canvas, so the ghost can settle to the
  // right level once the frame has finished sliding home.
  let hoverPoint: Point | null = null;
  let hoverIsMouse = false;
  // Set on release: the lifted ghost stays put while the frame springs back
  // into place, then holds a beat, and only then fades to its resting level.
  let releasing = false;
  let releaseBeat: ReturnType<typeof setTimeout> | null = null;

  /** The ghost's level with nothing going on: faint under the mouse, else gone. */
  function restingGhost(): number {
    if (!image || !hoverIsMouse || !hoverPoint) return GHOST_IDLE;
    const p = hoverPoint;
    const f = frameRect();
    const size = sourceDimensions(image);
    const overImage = p.x >= tx.v && p.x <= tx.v + size.width * scale.v
      && p.y >= ty.v && p.y <= ty.v + size.height * scale.v;
    const outside = p.x < f.x || p.x > f.x + f.w || p.y < f.y || p.y > f.y + f.h;
    return overImage && outside ? GHOST_HOVER : GHOST_IDLE;
  }

  /** Eases the ghost to its resting level, unless a release is still playing out. */
  function settleGhost(): void {
    if (releasing) return;
    ghost.set(restingGhost());
    loop.kick();
  }

  function beginInteraction(): void {
    releasing = false;
    if (releaseBeat) { clearTimeout(releaseBeat); releaseBeat = null; }
    ghost.set(GHOST_ACTIVE);
    guides.set(1);
    loop.kick();
  }

  function endInteraction(): void {
    guides.set(0);
    releasing = true;
    loop.kick();
  }

  /** Called each frame: once the frame has landed after a release, start the beat. */
  function tickRelease(): void {
    if (!releasing || dragging || releaseBeat) return;
    const geometrySettled = frameX.settled && frameY.settled && frameW.settled && frameH.settled
      && scale.settled && tx.settled && ty.settled && !morph;
    if (!geometrySettled) return;
    releaseBeat = setTimeout(() => {
      releaseBeat = null;
      releasing = false;
      settleGhost();
    }, GHOST_BEAT);
  }

  const hitTest = (p: Point, coarse = false): FrameHandle | null =>
    handleAt(p, frameRect(), coarse);

  function cursorFor(handle: FrameHandle | null): string {
    // Outside the frame is the picture, and the picture can be dragged.
    if (!handle) return 'grab';
    if (handle === 'move') return 'move';
    if (handle === 'n' || handle === 's') return 'ns-resize';
    if (handle === 'e' || handle === 'w') return 'ew-resize';
    if (handle === 'nw' || handle === 'se') return 'nwse-resize';
    return 'nesw-resize';
  }

  function setFrame(next: FrameRect): void {
    frameX.jump(next.x);
    frameY.jump(next.y);
    frameW.jump(next.w);
    frameH.jump(next.h);
    publish();
    loop.kick();
  }

  // The frame's own travel, clamped to the picture and nothing more. Same
  // reasoning as `legal`: the boundary is a fact about what a crop is, a magnet
  // is only a preference about where you probably meant to stop.
  function legalFramePosition(x: number, y: number, w: number, h: number): Point {
    const im = imageRect();
    return {
      x: clamp(x, im.x, Math.max(im.x, im.x + im.w - w)),
      y: clamp(y, im.y, Math.max(im.y, im.y + im.h - h)),
    };
  }

  function resizeFrame(start: FrameRect, handle: Exclude<FrameHandle, 'move'>, p: Point): FrameRect {
    const im = imageRect();
    const right = im.x + im.w;
    const bottom = im.y + im.h;
    const ratio = start.w / start.h || aspect;
    const minShort = Math.max(8, Math.min(MIN_FRAME_PX, Math.min(start.w, start.h) * 0.6));
    const visualMinW = Math.max(minShort, minShort * ratio);
    // Handle-resizing is another zoom route, so it honours the same ceiling as
    // wheel/pinch/slider zoom. At 400%, for example, the box may shrink by only
    // another half before it reaches the shared 800% maximum.
    const currentMinScale = image
      ? (() => {
          const source = sourceDimensions(image);
          return Math.max(start.w / source.width, start.h / source.height);
        })()
      : 1;
    const currentZoom = currentMinScale > 0 ? scale.v / currentMinScale : 1;
    const zoomMinW = start.w * currentZoom / MAX_ZOOM;
    const minW = Math.max(visualMinW, zoomMinW);

    // With no ratio to honour, every edge is its own answer. The floors are the
    // same two the preset path enforces — a box you can still grab, and the
    // shared zoom ceiling — applied to each axis rather than to the pair.
    if (freeform) {
      return resizeFree(start, handle, p, {
        image: im,
        minW: Math.max(minShort, zoomMinW),
        minH: Math.max(minShort, start.h * currentZoom / MAX_ZOOM),
      });
    }

    if (handle.length === 2) {
      const west = handle.includes('w');
      const north = handle.includes('n');
      const ax = west ? start.x + start.w : start.x;
      const ay = north ? start.y + start.h : start.y;
      const fromX = Math.max(0, west ? ax - p.x : p.x - ax);
      const fromY = Math.max(0, north ? ay - p.y : p.y - ay) * ratio;
      const width = Math.abs(fromX - start.w) >= Math.abs(fromY - start.w) ? fromX : fromY;
      const maxHorizontal = west ? ax - im.x : right - ax;
      const maxVertical = north ? ay - im.y : bottom - ay;
      const maxW = Math.max(8, Math.min(maxHorizontal, maxVertical * ratio));
      const w = clamp(width, Math.min(minW, maxW), maxW);
      const h = w / ratio;
      return {
        x: west ? ax - w : ax,
        y: north ? ay - h : ay,
        w,
        h,
      };
    }

    if (handle === 'e' || handle === 'w') {
      const west = handle === 'w';
      const ax = west ? start.x + start.w : start.x;
      const cy = start.y + start.h / 2;
      const desired = Math.max(0, west ? ax - p.x : p.x - ax);
      const maxHorizontal = west ? ax - im.x : right - ax;
      const maxVertical = 2 * Math.min(cy - im.y, bottom - cy);
      const maxW = Math.max(8, Math.min(maxHorizontal, maxVertical * ratio));
      const w = clamp(desired, Math.min(minW, maxW), maxW);
      const h = w / ratio;
      return { x: west ? ax - w : ax, y: cy - h / 2, w, h };
    }

    const north = handle === 'n';
    const ay = north ? start.y + start.h : start.y;
    const cx = start.x + start.w / 2;
    const desiredH = Math.max(0, north ? ay - p.y : p.y - ay);
    const maxVertical = north ? ay - im.y : bottom - ay;
    const maxHorizontal = 2 * Math.min(cx - im.x, right - cx);
    const maxH = Math.max(8, Math.min(maxVertical, maxHorizontal / ratio));
    const minH = minW / ratio;
    const h = clamp(desiredH, Math.min(minH, maxH), maxH);
    const w = h * ratio;
    return { x: cx - w / 2, y: north ? ay - h : ay, w, h };
  }

  function onPointerDown(e: PointerEvent): void {
    if (locked) return;
    if (!image) return;
    const p = localPoint(e);

    // The second finger may land outside the frame; once a gesture is already
    // under way it still belongs to that gesture.
    if (pointers.size === 0) {
      // Outside the frame is not "nothing to do": it is the part of the picture
      // you are about to bring in, so the drag pans the image beneath the crop.
      // Returning early here also lost the pointer itself — it was never
      // registered, so a second finger read as a first one and a pinch that
      // began anywhere but inside the crop box could not start at all.
      const handle = hitTest(p, e.pointerType !== 'mouse');
      // A gesture on the frame takes over the return animation where it stands.
      // A gesture on the picture is an image gesture like the wheel or a pinch,
      // so it lets the frame finish going home first — otherwise a stray tap on
      // the ghost would leave the frame stranded halfway back.
      if (handle) interruptMorph();
      else normalizeFrameImmediately();
      dragging = { pointerId: e.pointerId, handle: handle ?? 'pan', from: p, frame: frameRect() };
      hoverHandle = handle;
      canvas.style.cursor = handle === null ? 'grabbing'
        : handle === 'move' ? 'grabbing' : cursorFor(handle);
      beginInteraction();
    }

    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      // Pinch remains a direct image gesture. Preserve any crop movement the
      // first finger made, normalize it instantly, then hand off to zoom/pan.
      normalizeFrameImmediately();
      dragging = null;
      startPinch();
    }
  }

  let pinch: PinchState | null = null;
  function startPinch(): void {
    const [a, b] = [...pointers.values()];
    pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    beginInteraction();
  }

  function onPointerMove(e: PointerEvent): void {
    if (locked) return;
    if (!image) return;
    const point = localPoint(e);
    // Where this pointer was a moment ago, read before it is overwritten: a pan
    // is the step it just took, not the distance from where it started.
    const previous = pointers.get(e.pointerId) ?? point;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, point);

    if (pointers.size === 0) {
      hoverPoint = point;
      hoverIsMouse = e.pointerType === 'mouse';
      settleGhost();
      const next = hitTest(point, e.pointerType !== 'mouse');
      if (next !== hoverHandle) {
        hoverHandle = next;
        canvas.style.cursor = cursorFor(next);
        loop.kick();
      }
      return;
    }

    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch.dist > 0) zoomAt(dist / pinch.dist, mid.x, mid.y, true);
      // Two-finger drag pans as well as zooms.
      panBy(mid.x - pinch.mid.x, mid.y - pinch.mid.y);
      pinch = { dist, mid };
      loop.kick();
      return;
    }

    if (!dragging || dragging.pointerId !== e.pointerId) return;
    const dx = point.x - dragging.from.x;
    const dy = point.y - dragging.from.y;
    if (dragging.handle === 'pan') {
      // Outside the frame the picture moves, not the box. By the step just
      // taken rather than the distance from where the finger went down: the
      // image is clamped as it goes, and an absolute offset would keep piling
      // up against a wall it has already reached.
      panBy(point.x - previous.x, point.y - previous.y);
      loop.kick();
    } else if (dragging.handle === 'move') {
      const l = legalFramePosition(
        dragging.frame.x + dx,
        dragging.frame.y + dy,
        dragging.frame.w,
        dragging.frame.h,
      );
      setFrame({ ...dragging.frame, x: l.x, y: l.y });
    } else {
      setFrame(resizeFrame(dragging.frame, dragging.handle, point));
    }
  }

  function panBy(dx: number, dy: number): void {
    const l = legal(tx.v + dx, ty.v + dy);
    tx.jump(l.x);
    ty.jump(l.y);
  }

  function onPointerUp(e: PointerEvent): void {
    // A pan moved the picture under a frame that never left home, so there is
    // nothing to recentre — only the transform to let settle.
    const frameEdited = !!dragging && dragging.handle !== 'pan';
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      dragging = null;
      hoverHandle = null;
      canvas.style.cursor = 'default';
      if (frameEdited) {
        // The crop is settled the instant the pointer lifts. In freeform the
        // caller turns it into the new output size first, so the frame's way
        // home is already the right shape; the recentre itself is the same one
        // every other commit takes, and the source crop is untouched by it.
        if (freeform && image) onFreeformCommit?.(readFraming());
        normalizeFrame();
      } else settle();
      endInteraction();
    }
  }

  // `immediate` skips the settle, because a pinch settles on release instead.
  function zoomAt(factor: number, ax: number, ay: number, immediate = false): void {
    if (!image) return;
    const min = minScale();
    const from = scale.v;
    const to = clamp(from * factor, min * MIN_ZOOM, min * MAX_ZOOM);
    if (Math.abs(to - from) < 1e-6) return;
    // Keep the point under the cursor pinned to the cursor.
    scale.jump(to);
    tx.jump(ax - (ax - tx.v) * (to / from));
    ty.jump(ay - (ay - ty.v) * (to / from));
    // Zooming out can uncover an edge; clamp hard rather than let background
    // flash through the frame for a frame or two.
    const l = legal(tx.v, ty.v);
    tx.jump(l.x);
    ty.jump(l.y);
    if (!immediate) settle();
  }

  let wheelIdle: ReturnType<typeof setTimeout> | null = null;
  function onWheel(e: WheelEvent): void {
    if (locked) return;
    if (!image) return;
    e.preventDefault();
    normalizeFrameImmediately();
    const p = localPoint(e);
    // A wheel reports in lines or pages as readily as in pixels, and a notch
    // that means 3 lines on one machine and 100px on another is why zoom used to
    // land somewhere different on every mouse.
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1);
    // Trackpad pinch arrives as ctrl+wheel; plain wheel zooms too, since there
    // is nothing else on this canvas to scroll. The plain wheel is deliberately
    // gentle — a notch is a few percent, not a fifth of the picture — because
    // the size of the step is the whole complaint about wheel zoom. Anything
    // exact is done on the slider or typed into the field.
    const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0006));
    beginInteraction();
    zoomAt(factor, p.x, p.y, true);
    if (wheelIdle !== null) clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { settle(); endInteraction(); }, 140);
    loop.kick();
  }

  // ---- public surface ------------------------------------------------------

  function resize(): void {
    // Read the framing against the *old* stage before anything moves — it is
    // measured relative to the frame rect, which depends on vw/vh.
    const framing = image ? readFraming() : null;
    const r = stage.getBoundingClientRect();
    const nextDpr = Math.max(1, devicePixelRatio || 1);
    const nextVw = Math.max(1, Math.round(r.width));
    const nextVh = Math.max(1, Math.round(r.height));
    if (nextDpr === dpr && nextVw === vw && nextVh === vh) return;
    dpr = nextDpr;
    vw = nextVw;
    vh = nextVh;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    layoutFrame(true);
    if (image) applyFraming(framing);
    loop.kick();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', () => {
    hoverPoint = null;
    if (!pointers.size) settleGhost();
  });
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', () => { fill(); });

  function fill(): void {
    if (!image) return;
    normalizeFrameImmediately();
    applyFraming(null);
    loop.kick();
  }

  return {
    setLocked(next: boolean): void {
      if (locked === next) return;
      locked = next;
      canvas.style.cursor = 'default';
      if (next) { pointers.clear(); dragging = null; hoverHandle = null; }
      loop.kick();
    },
    setImage(next: HTMLImageElement | null, framing?: Framing | null): void {
      // The same picture handed back with a framing is a restore — undo, redo —
      // and the crop animates back to it. A new picture is placed outright.
      const restoring = next !== null && next === image && Boolean(framing);
      image = next;
      previewDirty = true;
      previewSource = null;
      slowSource = null;
      hoverHandle = null;
      canvas.style.cursor = 'default';
      if (next) {
        const applied = applyFraming(framing, restoring);
        // An image can arrive while the frame is still travelling toward a new
        // target — dropping a photo now sets the size from the photo, so this is
        // the ordinary case, not a corner. Framing against a rectangle that is
        // on its way somewhere else bakes in the magnification it happened to
        // have at that instant, and the picture lands cropped. Hand the crop to
        // the morph so it is re-derived until the frame actually arrives.
        //
        // Either way the framing given here is the truth from now on. A morph
        // seeded a moment earlier — setTarget reads the crop that was on screen
        // before a restore replaced it — must not be carried on top of it: one
        // more tick of that morph put the old crop straight back, which is why
        // undo used to land nowhere.
        const travelling = !frameX.settled || !frameY.settled || !frameW.settled || !frameH.settled;
        morph = travelling ? applied ?? readFraming() : null;
      }
      loop.kick();
    },
    // The live adjustment for whatever is on the stage. Only the pixels change:
    // the framing, the springs and the frame itself never hear about it.
    setAdjust(adjust: Adjustment): void {
      adjustment = adjust;
      previewDirty = true;
      loop.kick();
    },
    setTarget(w: number, h: number, immediate = false): void {
      targetW = w;
      targetH = h;
      aspect = w / h;
      morph = image && !immediate ? readFraming() : null;
      layoutFrame(immediate || !image);
      loop.kick();
    },
    // The ratio lock, and nothing else. The frame stays where it is: whatever
    // is on screen when the mode changes is a crop the user is looking at, and
    // moving it under them would be the app taking the composition back.
    setFreeform(on: boolean): void {
      freeform = on;
    },
    // How large to draw the frame. Only the magnification changes: the crop is
    // carried across the morph untouched, so standing back and leaning in are
    // statements about the view and never about the file.
    setFrameView(next: FrameView): void {
      if (frameView === next) return;
      frameView = next;
      morph = image ? readFraming() : null;
      layoutFrame(false);
      loop.kick();
    },
    getFrameView: () => frameView,
    // 1 while the frame is at true size; below 1 once the stage has capped it
    // — or once you have asked to stand back from it.
    getFrameScale: () => frameScale,
    canEnlarge: () => enlargeable,
    canShrink: () => shrinkable,
    // Zoom is stated against the smallest scale that still fills the frame, so
    // 100% is "the whole picture, nothing wasted" and every larger number is how
    // far in you have gone. That is the only reading the frame can support: the
    // floor moves with the frame's shape, and a percentage of the source pixels
    // would change under you every time the target did.
    // Dragging a frame handle does not magnify anything — `scale` does not move
    // — but the number this reports is measured against the frame, and in
    // Freeform the frame is changing shape under it. Which side dominates the
    // covering scale flips mid-gesture, and the readout lurches for a reason
    // that has nothing to do with what the user is doing. So while a handle is
    // held, the reference is the frame the drag started from: the reading then
    // says what is true, which is that the magnification has not changed.
    getZoom(): number {
      if (!image) return 1;
      const held = dragging && dragging.handle !== 'pan' ? dragging.frame : null;
      const min = held
        ? (() => {
            const source = sourceDimensions(image);
            return Math.max(held.w / source.width, held.h / source.height);
          })()
        : minScale();
      return min > 0 ? scale.v / min : 1;
    },
    getMaxZoom: () => MAX_ZOOM,
    getMinZoom: () => MIN_ZOOM,
    // Set from a control rather than a gesture: there is no cursor to keep a
    // point under, so the frame's own centre holds still.
    setZoom(zoom: number): void {
      if (!image) return;
      normalizeFrameImmediately();
      const min = minScale();
      const from = scale.v;
      const to = clamp(zoom, MIN_ZOOM, MAX_ZOOM) * min;
      if (from <= 0 || Math.abs(to - from) / from < 1e-6) return;
      beginInteraction();
      // Immediate: a slider is already a continuous gesture, and springing to
      // each value you drag through turns it into a lag.
      zoomAt(to / from, vw / 2, vh / 2, true);
      if (wheelIdle !== null) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => { settle(); endInteraction(); }, 400);
      loop.kick();
    },
    nudge(dx: number, dy: number): void {
      if (!image) return;
      normalizeFrameImmediately();
      beginInteraction();
      panBy(dx, dy);
      settle();
      if (wheelIdle !== null) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(endInteraction, 400);
      loop.kick();
    },
    zoomBy(factor: number): void {
      if (!image) return;
      normalizeFrameImmediately();
      beginInteraction();
      zoomAt(factor, vw / 2, vh / 2);
      if (wheelIdle !== null) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(endInteraction, 400);
      loop.kick();
    },
    fill,
    resize,
    getFraming: readFraming,
    hasImage: () => !!image,
  };
}
