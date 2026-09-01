/**
 * The live look, on the GPU.
 *
 * `adjust.ts` is the definition of what the sliders do, and it is a per-pixel
 * loop in JavaScript — right for a file that gets written once, hopeless for a
 * finger dragging a slider across a phone. So the same arithmetic is written
 * once more here as a fragment shader, reading the same `LookUniforms`, and the
 * viewfinder draws the result instead of the original photograph.
 *
 * The rule this file lives by: it renders a *preview*. It never writes a file.
 * Anything exported goes through `applyAdjustment` at full resolution, so a
 * driver bug or a missing extension can cost you a smooth preview and can never
 * cost you the picture.
 */

import type { Adjustment } from './domain/types.js';
import { lookUniforms, needsGlow } from './adjust.js';
import { canvasContext } from './infrastructure/dom.js';

/** How far the bright-pass is amplified before it is stored in eight bits. */
const GLOW_GAIN = 2;
/** The blur runs at a quarter of the preview, which is all a glow needs. */
const GLOW_STEP = 4;
/**
 * The preview is never larger than this on its long side. The stage is at most
 * a couple of thousand device pixels and the frame is drawn from this at a
 * scale, so more resolution here buys nothing and costs a phone its frame rate.
 */
const MAX_PREVIEW = 2048;

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const BRIGHT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
void main() {
  vec3 c = texture2D(uSource, vUv).rgb;
  float over = max(0.0, dot(c, LUMA) - 0.62);
  gl_FragColor = vec4(c * over * ${GLOW_GAIN}.0, 1.0);
}`;

const BLUR = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uStep;
void main() {
  vec3 sum = vec3(0.0);
  for (int i = -3; i <= 3; i++) {
    sum += texture2D(uSource, vUv + uStep * float(i)).rgb;
  }
  gl_FragColor = vec4(sum / 7.0, 1.0);
}`;

const LOOK = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform sampler2D uGlow;
uniform vec2 uTexel;
uniform float uGain, uHighlights, uShadows, uWhites, uBlacks, uBlackLift;
uniform float uContrast, uCurve, uKnee;
uniform float uTemperature, uTint, uVibrance, uSaturation, uShadowCool, uHighlightWarm;
uniform float uClarity, uClarityRadius, uSharpen;
uniform float uBloom, uHalation, uVignette, uFringe;
uniform float uGrain, uGrainCell, uGrainRoughness, uGrainColor, uHighlightProtect;
uniform vec2 uSize;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float GAMMA = 2.2;

float hash(float x, float y, float seed) {
  float v = sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return fract(v) * 2.0 - 1.0;
}

float lumaAt(vec2 offset) {
  return dot(texture2D(uSource, clamp(vUv + offset * uTexel, vec2(0.0), vec2(1.0))).rgb, LUMA);
}

void main() {
  vec2 fringe = vec2(uFringe, 0.0) * uTexel;
  vec4 mid = texture2D(uSource, vUv);
  float r0 = texture2D(uSource, clamp(vUv + fringe, vec2(0.0), vec2(1.0))).r;
  float b0 = texture2D(uSource, clamp(vUv - fringe, vec2(0.0), vec2(1.0))).b;
  vec3 c = vec3(r0, mid.g, b0);

  c = pow(max(pow(c, vec3(GAMMA)) * uGain, vec3(0.0)), vec3(1.0 / GAMMA));
  float luma = dot(c, LUMA);

  float light = uShadows * pow(1.0 - luma, 2.0) * 0.55
    + uHighlights * pow(luma, 2.0) * 0.55
    + uWhites * pow(luma, 4.0) * 0.38
    + uBlacks * pow(1.0 - luma, 4.0) * 0.38
    + uBlackLift * 0.15;
  c += light;

  c = (c - 0.5) * uContrast + 0.5;
  vec3 s = clamp(c, 0.0, 1.0);
  c += (s * s * (3.0 - 2.0 * s) - c) * uCurve;
  c = c / (1.0 + max(vec3(0.0), c - 0.62) * uKnee * 0.7 * 3.0);

  luma = dot(c, LUMA);
  float muted = 1.0 - clamp(max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b), 0.0, 1.0);
  c = vec3(luma) + (c - vec3(luma)) * (uSaturation * (1.0 + uVibrance * muted * 0.75));
  c.r += uTemperature * 0.12 + uTint * 0.06;
  c.g -= uTint * 0.08;
  c.b -= uTemperature * 0.12 - uTint * 0.06;
  float shadowMask = pow(1.0 - clamp(luma, 0.0, 1.0), 2.0) * uShadowCool;
  float highlightMask = pow(clamp(luma, 0.0, 1.0), 2.0) * uHighlightWarm;
  c += vec3(highlightMask * 0.12, highlightMask * 0.045, shadowMask * 0.12);

  float here = lumaAt(vec2(0.0));
  float edge = 0.0;
  if (uClarity != 0.0) {
    float k = uClarityRadius;
    float around = (lumaAt(vec2(-k, 0.0)) + lumaAt(vec2(k, 0.0))
      + lumaAt(vec2(0.0, -k)) + lumaAt(vec2(0.0, k))) * 0.25;
    edge += (here - around) * uClarity * 0.9;
  }
  if (uSharpen != 0.0) {
    float around = (lumaAt(vec2(-1.0, 0.0)) + lumaAt(vec2(1.0, 0.0))
      + lumaAt(vec2(0.0, -1.0)) + lumaAt(vec2(0.0, 1.0))) * 0.25;
    edge += (here - around) * uSharpen * 1.4;
  }
  c += edge;

  vec3 glow = texture2D(uGlow, vUv).rgb / ${GLOW_GAIN}.0;
  c += glow * uBloom * 1.7 + glow * uHalation * vec3(2.6, 0.7, 0.25);

  vec2 n = vUv * 2.0 - 1.0;
  float fall = clamp((dot(n, n) - 0.18) / 1.45, 0.0, 1.0);
  c *= 1.0 - fall * uVignette * (uVignette >= 0.0 ? 0.72 : 0.38);

  if (uGrain != 0.0) {
    vec2 cell = floor(vUv * uSize / uGrainCell);
    float protect = 1.0 - clamp(luma, 0.0, 1.0) * uHighlightProtect;
    float mono = hash(cell.x, cell.y, 1.0) * uGrain * uGrainRoughness * 0.12 * protect;
    float chroma = uGrainColor * uGrain * 0.055 * protect;
    c += vec3(mono) + vec3(
      hash(cell.x, cell.y, 2.0),
      hash(cell.x, cell.y, 3.0),
      hash(cell.x, cell.y, 4.0)
    ) * chroma;
  }

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), mid.a);
}`;

/** One photograph's worth of GPU state, kept alive between frames. */
export interface AdjustPreview {
  /**
   * The photograph with the look on it, ready to be drawn wherever the original
   * would have been. `null` means this device could not do it and the caller
   * should fall back — never that the adjustment was empty.
   */
  render(image: HTMLImageElement, adjustment: Adjustment): HTMLCanvasElement | null;
  dispose(): void;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Cannot create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown';
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log}`);
  }
  return shader;
}

function link(gl: WebGLRenderingContext, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Cannot create program');
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown';
    gl.deleteProgram(program);
    throw new Error(`Program failed to link: ${log}`);
  }
  return program;
}

function target(gl: WebGLRenderingContext, width: number, height: number): {
  texture: WebGLTexture;
  frame: WebGLFramebuffer;
} {
  const texture = gl.createTexture();
  const frame = gl.createFramebuffer();
  if (!texture || !frame) throw new Error('Cannot create render target');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, frame };
}

/**
 * Build the GPU preview, or return `null` if this browser cannot offer one.
 * Called once; a context lost later simply stops producing frames and the
 * viewfinder goes back to its approximation.
 */
export function createAdjustPreview(): AdjustPreview | null {
  let canvas: HTMLCanvasElement;
  let gl: WebGLRenderingContext;
  try {
    canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false,
    }) ?? canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false,
    });
    if (!context) return null;
    gl = context as WebGLRenderingContext;
  } catch { return null; }

  let look: WebGLProgram;
  let bright: WebGLProgram;
  let blur: WebGLProgram;
  try {
    look = link(gl, LOOK);
    bright = link(gl, BRIGHT);
    blur = link(gl, BLUR);
  } catch { return null; }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const cap = Math.max(256, Math.min(MAX_PREVIEW, maxTexture));

  const source = gl.createTexture();
  if (!source) return null;
  gl.bindTexture(gl.TEXTURE_2D, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);

  // Scratch used only when a photograph is larger than the preview cap.
  let shrink: HTMLCanvasElement | null = null;

  let uploaded: HTMLImageElement | null = null;
  let width = 0, height = 0, scale = 1;
  let glowA: { texture: WebGLTexture; frame: WebGLFramebuffer } | null = null;
  let glowB: { texture: WebGLTexture; frame: WebGLFramebuffer } | null = null;
  let glowW = 0, glowH = 0;
  let dead = false;

  /** Where a named uniform lives in a program; `null` if the compiler dropped it. */
  const uniform = (program: WebGLProgram, name: string): WebGLUniformLocation | null =>
    gl.getUniformLocation(program, name);

  /**
   * Put a photograph on the GPU, shrunk to the preview cap if it is larger, and
   * size the glow buffers to match. Done once per photograph rather than once
   * per frame: uploading a twenty-megapixel texture is the expensive part, and
   * moving a slider does not change the picture underneath it.
   */
  function upload(image: HTMLImageElement): boolean {
    const naturalW = image.naturalWidth || image.width;
    const naturalH = image.naturalHeight || image.height;
    if (!naturalW || !naturalH) return false;
    const fit = Math.min(1, cap / Math.max(naturalW, naturalH));
    width = Math.max(1, Math.round(naturalW * fit));
    height = Math.max(1, Math.round(naturalH * fit));
    scale = width / naturalW;

    gl.bindTexture(gl.TEXTURE_2D, source);
    if (fit < 1) {
      shrink ??= document.createElement('canvas');
      shrink.width = width;
      shrink.height = height;
      const ctx = canvasContext(shrink);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, width, height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shrink);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }

    canvas.width = width;
    canvas.height = height;
    const nextGlowW = Math.max(1, Math.ceil(width / GLOW_STEP));
    const nextGlowH = Math.max(1, Math.ceil(height / GLOW_STEP));
    if (!glowA || !glowB || nextGlowW !== glowW || nextGlowH !== glowH) {
      for (const old of [glowA, glowB]) {
        if (!old) continue;
        gl.deleteTexture(old.texture);
        gl.deleteFramebuffer(old.frame);
      }
      glowW = nextGlowW;
      glowH = nextGlowH;
      glowA = target(gl, glowW, glowH);
      glowB = target(gl, glowW, glowH);
    }
    uploaded = image;
    return true;
  }

  /** Draw the full-screen triangle through one program into one target. */
  function pass(program: WebGLProgram, into: WebGLFramebuffer | null, w: number, h: number): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, into);
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * The light that spills: the bright parts of the picture, blurred, left in
   * `glowA` for the look pass to add back as bloom (white) and halation (red).
   * Both are the same spill seen through different glass, so it is built once.
   */
  function renderGlow(): void {
    if (!glowA || !glowB) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.useProgram(bright);
    gl.uniform1i(uniform(bright, 'uSource'), 0);
    pass(bright, glowA.frame, glowW, glowH);

    gl.useProgram(blur);
    gl.uniform1i(uniform(blur, 'uSource'), 0);
    // Two separable passes each way: a box blur run twice is close enough to a
    // Gaussian that a glow cannot give it away, and costs four cheap draws.
    for (let round = 0; round < 2; round += 1) {
      gl.bindTexture(gl.TEXTURE_2D, glowA.texture);
      gl.uniform2f(uniform(blur, 'uStep'), 1 / glowW, 0);
      pass(blur, glowB.frame, glowW, glowH);
      gl.bindTexture(gl.TEXTURE_2D, glowB.texture);
      gl.uniform2f(uniform(blur, 'uStep'), 0, 1 / glowH);
      pass(blur, glowA.frame, glowW, glowH);
    }
  }

  return {
    render(image, adjustment): HTMLCanvasElement | null {
      if (dead || gl.isContextLost()) return null;
      try {
        if (image !== uploaded && !upload(image)) return null;
        if (!glowA) return null;
        const u = lookUniforms(adjustment, scale);

        if (needsGlow(u)) {
          renderGlow();
        } else {
          // Nothing is glowing, so the glow buffer has to be black rather than
          // whatever the last look left in it.
          gl.bindFramebuffer(gl.FRAMEBUFFER, glowA.frame);
          gl.viewport(0, 0, glowW, glowH);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }

        gl.useProgram(look);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        gl.uniform1i(uniform(look, 'uSource'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, glowA.texture);
        gl.uniform1i(uniform(look, 'uGlow'), 1);
        gl.activeTexture(gl.TEXTURE0);

        gl.uniform2f(uniform(look, 'uTexel'), 1 / width, 1 / height);
        gl.uniform2f(uniform(look, 'uSize'), width, height);
        for (const [name, number] of [
          ['uGain', u.gain], ['uHighlights', u.highlights], ['uShadows', u.shadows],
          ['uWhites', u.whites], ['uBlacks', u.blacks], ['uBlackLift', u.blackLift],
          ['uContrast', u.contrast], ['uCurve', u.curve], ['uKnee', u.knee],
          ['uTemperature', u.temperature], ['uTint', u.tint], ['uVibrance', u.vibrance],
          ['uSaturation', u.saturation], ['uShadowCool', u.shadowCool],
          ['uHighlightWarm', u.highlightWarm], ['uClarity', u.clarity],
          ['uClarityRadius', u.clarityRadius], ['uSharpen', u.sharpen],
          ['uBloom', u.bloom], ['uHalation', u.halation], ['uVignette', u.vignette],
          ['uFringe', u.fringe], ['uGrain', u.grain], ['uGrainCell', u.grainCell],
          ['uGrainRoughness', u.grainRoughness], ['uGrainColor', u.grainColor],
          ['uHighlightProtect', u.highlightProtect],
        ] as const) {
          gl.uniform1f(uniform(look, name), number);
        }

        pass(look, null, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return canvas;
      } catch {
        dead = true;
        return null;
      }
    },
    dispose(): void {
      dead = true;
      uploaded = null;
      for (const old of [glowA, glowB]) {
        if (!old) continue;
        gl.deleteTexture(old.texture);
        gl.deleteFramebuffer(old.frame);
      }
      glowA = null;
      glowB = null;
      gl.deleteTexture(source);
      gl.deleteBuffer(quad);
      gl.deleteProgram(look);
      gl.deleteProgram(bright);
      gl.deleteProgram(blur);
    },
  };
}
