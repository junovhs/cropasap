// The content-aware autoframer is on ice: it moved the crop without being
// asked, which read as confusion rather than help. `autoframe.ts` stays in the
// tree for when it comes back behind an explicit command.
// import { autoFrame } from '../autoframe.js';
import { sourceDimensions } from '../infrastructure/image-decoder.js';
import type { CropItem, Framing, OutputTarget } from '../domain/types.js';

export const targetKey = (target: OutputTarget): string => `${target.w}x${target.h}`;

export const wholeFrame = (item: CropItem): Framing => {
  const source = sourceDimensions(item.image);
  return {
    cx: source.width / 2,
    cy: source.height / 2,
    cropW: source.width,
    cropH: source.height,
  };
};

function refitSource(item: CropItem, framing: Framing | null, aspect: number): Framing {
  const source = sourceDimensions(item.image);
  if (!framing) return suggestedSourceFrame(item, aspect);
  let cropW = framing.cropW;
  let cropH = cropW / aspect;
  const fitting = Math.min(1, source.width / cropW, source.height / cropH);
  cropW *= fitting;
  cropH *= fitting;
  return {
    cropW,
    cropH,
    cx: Math.min(Math.max(framing.cx, cropW / 2), source.width - cropW / 2),
    cy: Math.min(Math.max(framing.cy, cropH / 2), source.height - cropH / 2),
  };
}

// The suggested crop is the largest rectangle of the target shape, centred.
function suggestedSourceFrame(item: CropItem, aspect: number): Framing {
  const source = sourceDimensions(item.image);
  let cropW = Math.min(source.width, source.height * aspect);
  let cropH = cropW / aspect;
  if (cropH > source.height) { cropH = source.height; cropW = cropH * aspect; }
  return { cx: source.width / 2, cy: source.height / 2, cropW, cropH };
  /* On ice — the content-aware placement:
  const preview = autoFrame(item.image, aspect);
  const xScale = source.width / item.image.naturalWidth;
  const yScale = source.height / item.image.naturalHeight;
  return refitSource(item, {
    cx: preview.cx * xScale,
    cy: preview.cy * yScale,
    cropW: preview.cropW * xScale,
    cropH: preview.cropH * yScale,
  }, aspect);
  */
}

export function suggestFrame(item: CropItem, target: OutputTarget): CropItem {
  return {
    ...item,
    frame: suggestedSourceFrame(item, target.w / target.h),
    framedFor: targetKey(target),
    auto: true,
  };
}

export function fitFrameToTarget(item: CropItem, target: OutputTarget): CropItem {
  if (item.framedFor === targetKey(target)) return item;
  if (item.auto) return suggestFrame(item, target);
  return {
    ...item,
    frame: refitSource(item, item.frame, target.w / target.h),
    framedFor: targetKey(target),
  };
}

export function acceptFrame(item: CropItem): CropItem {
  return item.approved && !item.auto
    ? item
    : { ...item, approved: true, auto: false };
}

export function useWholeImage(item: CropItem, target: OutputTarget): CropItem {
  return {
    ...item,
    frame: wholeFrame(item),
    auto: false,
    framedFor: targetKey(target),
  };
}
