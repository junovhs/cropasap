import { mountPanel } from 'dopedocs/panel';
import { docsContent } from './docs-content.js';
// Wiring: intake, the viewfinder, the readouts, and the keyboard.

import { store, createItem, activeItem } from './state.js';
import { alphaOf } from './infrastructure/alpha.js';
import { createViewfinder, type FrameView } from './viewfinder.js';
import { createSizePicker } from './sizepicker.js';
import { ratioLabel } from './search.js';
import { createFilmstrip } from './filmstrip.js';
import { scaledTarget } from './export.js';
import { createAdjustPanel, neutral } from './adjust.js';
import { paintIcons } from './icons.js';
import { createExportPanel, type ExportPanelController } from './presentation/export-panel.js';
import { createConvertPanel, type ConvertPanelController } from './presentation/convert-panel.js';
import { acceptFrame, fitFrameToTarget, suggestFrame, targetKey, useWholeImage, wholeFrame } from './application/framing.js';
import {
  FREEFORM_LABEL, commitFreeform, enterFreeform, exitFreeform, releaseFreeform,
} from './application/freeform.js';
import { tickFromZoom, zoomFromTick, type ZoomRange } from './application/zoom.js';
import {
  decodeEditingImage,
  decodeImage,
  EDIT_PREVIEW_MAX_EDGE,
  previewDimensions,
  QUEUE_PREVIEW_MAX_EDGE,
  sourceDimensions,
} from './infrastructure/image-decoder.js';
import { requiredElement, requiredElements } from './infrastructure/dom.js';
import { loadPinned, pinId, removePinned } from './pinned.js';
import { createHistory } from './history.js';
import { createAccount } from './account.js';
import { createSizeSync, type SyncStatus } from './size-sync.js';
import { onSizesWritten } from './size-store-events.js';
import type {
  AppState, CropItem, Framing, OutputTarget, PinnedSize, SizeResult,
} from './domain/types.js';

const $ = <T extends Element = HTMLElement>(selector: string): T => requiredElement<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string): T[] => requiredElements<T>(selector);
const canvas = $<HTMLCanvasElement>('#canvas');
const stage = $<HTMLElement>('#stage');
const fileInput = $<HTMLInputElement>('#file');

let exportPanel: ExportPanelController | null = null;
let convertPanel: ConvertPanelController | null = null;

// Where the app goes back to when Freeform is turned off and there is no preset
// to restore — the size it booted with, before anything had been chosen.
const DEFAULT_TARGET: OutputTarget = { ...store.get().target };

const isFreeform = (): boolean => store.get().cropMode === 'freeform';
// The one breakpoint the script needs to know about: below it the panel is a
// screen of its own and the stage has no room for anything it does not need.
const narrow = (): boolean => matchMedia('(max-width: 900px)').matches;

function announce(message: string): void {
  const el = $('#status');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

// A sentence about something the app did on your behalf. It is not an error and
// there is nothing to answer, so it says its piece and leaves.
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
function showNotice(message: string): void {
  const el = $('#notice');
  el.textContent = message;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('open'));
  if (noticeTimer !== null) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    el.classList.remove('open');
    noticeTimer = setTimeout(() => { el.hidden = true; }, 220);
  }, 4_200);
}

const view = createViewfinder({
  canvas,
  stage,
  // A freeform crop is finished the moment it is released, and the size it
  // stands for is its own pixels. Setting that target is what sends the frame
  // home — the same recentre every other commit uses, with the source crop
  // stated outright first so the animation cannot move it.
  onFreeformCommit(framing) {
    const state = store.transact((current) => commitFreeform(current, framing));
    if (state.cropMode !== 'freeform') return;
    view.setTarget(state.target.w, state.target.h);
    showTarget(state.target);
    markActivePin();
    syncFitChrome();
    syncUI();
  },
  // The viewfinder owns the live transform; the store owns the decision.
  onFrameChange(framing) {
    const item = activeItem();
    const { target } = store.get();
    // The frame animates between shapes, so a framing read mid-morph has an
    // aspect that belongs to neither size. Record only once it has arrived —
    // otherwise pressing Enter through a batch stores half-morphed crops.
    const settled = Math.abs(framing.cropW / framing.cropH - target.w / target.h) < 0.005;
    if (item && settled) {
      store.updateItem(item.id, (current) => {
        const previous = current.frame;
        const unchanged = previous
          && Math.abs(previous.cx - framing.cx) < 0.01
          && Math.abs(previous.cy - framing.cy) < 0.01
          && Math.abs(previous.cropW - framing.cropW) < 0.01
          && Math.abs(previous.cropH - framing.cropH) < 0.01;
        return unchanged ? current : { ...current, frame: framing };
      });
    }
    updateReadout(framing);
    syncStripSoon();
  },
});

// onFrameChange fires every animation frame; the thumbnail only needs to catch
// up once the framing stops moving.
let stripTimer: ReturnType<typeof setTimeout> | null = null;
function syncStripSoon(): void {
  if (stripTimer !== null) clearTimeout(stripTimer);
  stripTimer = setTimeout(() => syncUI(), 160);
}

// ---- readouts --------------------------------------------------------------

function updateReadout(framing: Framing | null): void {
  const { target } = store.get();
  if (!framing) return;
  syncZoom();
  const w = Math.round(framing.cropW);
  const h = Math.round(framing.cropH);

  // In Freeform the output *is* the crop, so both the panel that normally names
  // a chosen size and the chip on the stage state the pixels being cut — live,
  // while they change. Against a preset the crop's own size answers nothing the
  // export cares about, so the chip stays away.
  const freeform = isFreeform();
  $('#cropChip').hidden = !freeform;
  if (freeform) {
    $('#cropSize').textContent = `${w} × ${h}`;
    $('#sizeName').textContent = FREEFORM_LABEL;
    $('#sizeDims').textContent = `${w} × ${h}`;
    $('#sizeRatio').textContent = w > 0 && h > 0 ? ratioLabel(w, h) : '';
  }

  // How much real detail is behind each output pixel. Below 1.0 we are
  // enlarging, which is the only thing that actually costs quality here. The
  // export multiplier is part of that sum: at 4x the file wants four times the
  // pixels in each direction, and the chip has to say so while it can still be
  // changed for free.
  const out = scaledTarget(target, exportPanel?.getScale() ?? 1);
  const ratio = Math.min(framing.cropW / out.w, framing.cropH / out.h);
  const chip = $('#qualityChip');
  const label = $('#quality');
  chip.className = 'chip zoom-quality';
  // A crop that is exactly the output size is the common case now that an image
  // opens at its own resolution, and it arrives through a spring, so it lands a
  // ten-thousandth short of 1 as often as not. Calling that "soft" would be a
  // lie told by floating point.
  if (ratio >= 0.999) { label.textContent = 'sharp'; chip.classList.add('good'); }
  else if (ratio >= 0.75) { label.textContent = `${Math.round(ratio * 100)}% — soft`; chip.classList.add('warn'); }
  else { label.textContent = `${Math.round(ratio * 100)}% — blurry`; chip.classList.add('bad'); }
}

// The top bar names the file and states the pixels it arrived with. Both are
// machine facts about the source, so both are set in mono and neither changes
// as you crop — the crop's own numbers live in the readout on the stage.
function showFileIdentity(item: CropItem): void {
  const source = sourceDimensions(item.image);
  $('#filename').textContent = item.file.name;
  $('#fileDims').textContent = `${source.width} × ${source.height}`;
}

// ---- rooms -----------------------------------------------------------------

// Three rooms rather than two jobs and a switch. Crop and Adjust are two things
// to do to the picture in front of you; Batch is a different proposition
// entirely — a queue, a beat, and an export that writes many files — and it was
// previously a flag laid over the other two. That leaked: the queue appeared
// before there was a queue, stayed on screen after you had left it, and leaving
// destroyed it. A room you are either in or not in cannot do any of that.
// Convert joined them later and belongs by the same test: it is a thing you
// came here to do to an image, not a setting on the way out. The export panel
// changes the format of a crop; Convert changes the format of a file and
// touches nothing else about it.
type Room = 'crop' | 'adjust' | 'batch' | 'convert';
let room: Room = 'crop';
let hasImage = false;
let loadingActive = false;

// The framing surface belongs to two of the four rooms: Batch is Crop with a
// queue attached, so the frame, the zoom and the readouts are all still the job.
// Adjust and Convert both leave the framing alone, so neither shows its chrome.
const framingRoom = (): boolean => room !== 'adjust' && room !== 'convert';

// One place decides what is on the stage, because visibility depends on both
// facts at once — whether there is an image, and which room you are in.
function syncStageChrome(): void {
  const framing = framingRoom();
  const batching = room === 'batch';
  const converting = room === 'convert';
  // Convert's stage is its own drop zone (DEC-07), so the crop's welcome card
  // never stands in front of it.
  $('#empty').hidden = (hasImage && !loadingActive) || converting;
  // The rooms are the app's navigation, so they stay on screen and go quiet
  // instead of disappearing: an empty rail reads as a broken rail. Batch is the
  // exception — it is a door to somewhere else, and it opens with no picture.
  $<HTMLButtonElement>('#modeCrop').disabled = !hasImage;
  $<HTMLButtonElement>('#modeAdjust').disabled = !hasImage;
  // Convert is a front door too: converting needs files, not a picture on the
  // stage, so the room opens empty and asks for them.
  $('#adjust').hidden = !hasImage || room !== 'adjust';
  // Nothing frames in Adjust or Convert, so the stage stops taking pointers
  // and the phone layout gives the drawer its own room below the picture.
  view.setLocked(!framing);
  document.body.classList.toggle('is-adjusting', hasImage && room === 'adjust');
  // The panel belongs to the room you are in: Convert's choices and button
  // replace the crop's, so no control is ever on screen twice (DEC-07).
  document.body.classList.toggle('is-converting', converting);
  $('#convertTable').hidden = !converting;
  $('#sheetOpenLabel').textContent = converting ? 'Convert' : 'Export';
  // With nothing listed there is nothing to convert, so the phone's sheet
  // button waits for files instead of opening onto a disabled one.
  $('#sheetOpen').classList.toggle('is-idle', converting && !hasImage);
  convertPanel?.setActive(converting);
  // The crop readouts describe a framing decision, so they are only true while
  // that is the decision being made.
  $('#readout').hidden = !hasImage || !framing;
  $('#hints').hidden = !hasImage || !framing;
  // Visibility depends on the frame's room as well as the mode, so it is
  // settled in one place — syncFitChrome, which is also what resize calls.
  syncFitChrome();
  // Zoom is a fact about the framing, so it is on screen exactly as long as the
  // framing is the job in hand.
  $('#zoomTool').hidden = !hasImage || !framing;
  // Freeform is one image's answer, so it is not on offer in the room whose
  // whole basis is a size every image shares.
  $('#freeform').hidden = !hasImage || !framing || batching;
  $('#modeCrop').setAttribute('aria-selected', String(room === 'crop'));
  $('#modeAdjust').setAttribute('aria-selected', String(room === 'adjust'));
  $('#modeConvert').setAttribute('aria-selected', String(room === 'convert'));
  $('#modeBatch').setAttribute('aria-selected', String(batching));
  syncFramingChrome();
}

// ---- framing a batch -------------------------------------------------------

// Approving a crop is the one thing a batch cannot do for you, and a keyboard
// shortcut nobody has been told about is not an interface. So the beat gets a
// button, the button says its own shortcut, and while a crop is still owed the
// rest of the screen steps back so there is one obvious thing to do.
function syncFramingChrome(): void {
  const state = store.get();
  const item = activeItem(state);
  const framing = room === 'batch' && !!item;
  $('#framing').hidden = !framing;

  if (!framing || !item) {
    document.body.classList.remove('is-framing');
    return;
  }

  const total = state.items.length;
  const done = state.items.filter((i) => i.approved).length;
  const owed = !item.approved;

  $<HTMLButtonElement>('#finalize').hidden = !owed;
  // The narrow layout's copy of the same beat, living in the queue's own row.
  $<HTMLButtonElement>('#finalizeSmall').hidden = !owed;
  $('#framingStep').textContent = owed
    ? `Image ${state.activeIndex + 1} of ${total}${done ? ` · ${done} framed` : ''}`
    : done === total
      ? `All ${total} framed — export them below`
      : `${done} of ${total} framed`;
  $('#framingStep').classList.toggle('is-done', !owed && done === total);
  // Nothing is dimmed once the queue is finished: the next thing to look at is
  // the export button, and it lives in the panel that was being held back.
  document.body.classList.toggle('is-framing', owed);
}

// The explainer DEC-04 requires whenever a drop puts the app into batch by
// itself. It also gives preview preparation useful cover time: size search is
// cheap and immediately interactive while the bounded queue decodes behind it.
let coachChoice: SizeResult | null = null;
let coachReady = false;
let coachPrepared = 0;
let coachTotal = 0;

function syncCoach(): void {
  const choice = coachChoice;
  $('#coachSizeValue').textContent = choice
    ? `${choice.name} · ${choice.w} × ${choice.h}`
    : 'Choose a size';
  const preparing = $('#coachPreparing');
  preparing.textContent = coachReady
    ? `${coachTotal} image${coachTotal === 1 ? '' : 's'} ready.`
    : `Preparing ${coachPrepared} of ${coachTotal} images in the background…`;
  preparing.classList.toggle('is-ready', coachReady);
  const confirm = $<HTMLButtonElement>('#coachConfirm');
  confirm.disabled = !choice || !coachReady;
  confirm.textContent = !choice
    ? 'Choose a size to continue'
    : coachReady
      ? 'Confirm size and start framing'
      : 'Finishing image preparation…';
}

function openCoach(count: number): void {
  if (sizePicker.isOpen()) sizePicker.close();
  $('#coachTitle').textContent = `${count} images — one crop at a time`;
  coachChoice = null;
  coachReady = false;
  coachPrepared = 0;
  coachTotal = count;
  syncCoach();
  const coach = $('#coach');
  coach.hidden = false;
  requestAnimationFrame(() => {
    coach.classList.add('open');
    $<HTMLButtonElement>('#coachSize').focus();
  });
}

function noteCoachPrepared(): void {
  if ($('#coach').hidden) return;
  coachPrepared = Math.min(coachTotal, coachPrepared + 1);
  syncCoach();
}

function finishCoachPreparation(readyCount: number): void {
  coachTotal = readyCount;
  coachPrepared = coachTotal;
  coachReady = true;
  syncCoach();
}

function hideCoachPicker(): void {
  $('#coachPanel').classList.remove('is-picking');
  $('#coachPickerHost').hidden = true;
  $('#coachCopy').hidden = false;
}

function openCoachPicker(): void {
  $('#coachCopy').hidden = true;
  $('#coachPickerHost').hidden = false;
  $('#coachPanel').classList.add('is-picking');
  sizePicker.open({
    host: $<HTMLElement>('#coachPickerHost'),
    returnFocus: $<HTMLButtonElement>('#coachSize'),
    includeTemplate: false,
    onClose: hideCoachPicker,
  });
}

function closeCoach(promote = true): void {
  const coach = $('#coach');
  if (coach.hidden) return;
  if (sizePicker.isOpen()) sizePicker.close();
  coach.classList.remove('open');
  coach.hidden = true;
  canvas.focus();
  // The automatic Batch explainer owns the foreground until it is dismissed.
  // Only after its closing frame has painted may the active queue preview be
  // promoted, so no image preparation can delay this button or its response.
  if (promote) requestAnimationFrame(() => promoteActiveImage());
}

const ROOM_SAID: Readonly<Record<Room, string>> = {
  crop: 'Crop. Move or resize the frame, then it recentres with your crop',
  adjust: 'Adjust. The crop is left exactly as it was',
  batch: 'Batch. Frame each image, then keep it',
  convert: 'Convert. Change the format and keep every pixel',
};

/**
 * Go to a room.
 *
 * Batch is the one with a door rather than a light switch. Entering it needs a
 * queue, so with nothing queued it asks for one and waits — the room does not
 * open, and nothing about the screen changes, until images actually arrive.
 * That is the whole fix for a filmstrip that used to appear the instant the
 * control was touched and stay after you had gone.
 *
 * Leaving keeps the queue. Navigating away from a room is not a decision to
 * throw its contents out, and coming back to find the work gone is the kind of
 * thing that costs trust once and for good.
 */
function goTo(next: Room): void {
  if (next === room) return;

  if (next === 'batch' && store.get().items.length < 2) {
    awaitingBatchSize = true;
    announce('Choose the images to frame');
    openPicker();
    return;
  }

  const leavingConvert = room === 'convert';
  room = next;
  store.set({ batch: next === 'batch' });
  // Convert reads its files at thumbnail size. Back on a frame, the picture
  // gets its full editing preview.
  if (leavingConvert) promoteActiveImage();
  syncStageChrome();
  syncUI();
  announce(ROOM_SAID[next]);
  if (next !== 'adjust' && next !== 'convert') canvas.focus();
}

function setChromeVisible(on: boolean): void {
  hasImage = on;
  syncStageChrome();
  // What the size panel can honestly say about an unchosen size depends on
  // whether there is a picture for it to have come from.
  syncSizeConfidence();
}

// ---- adjustments -----------------------------------------------------------

// The panel is a view of one item's numbers, never a store of its own: it is
// loaded from whatever is on the stage and writes straight back to it, so the
// answers belong to the image and cannot follow you to the next one.
const adjustPanel = createAdjustPanel({
  rows: $('#adjustRows'),
  reset: $('#adjustReset'),
  onAnnounce: announce,
  onChange(adjust) {
    const item = activeItem();
    if (item) store.updateItem(item.id, (current) => ({ ...current, adjust }));
    view.setAdjust(adjust);
    // The filmstrip is a contact sheet of what would be exported, so it has to
    // carry the adjustment too — but only once the slider stops moving.
    syncStripSoon();
  },
});

function showAdjust(item: CropItem): void {
  view.setAdjust(adjustPanel.load(item.adjust || neutral()));
}

// ---- how large the frame is drawn ------------------------------------------

// The frame is the output at its real size (DEC-03), and the other two views
// are departures from it: closer for detail, further back for composition.
// Two things need saying: which of them you are in, and — whenever what you are
// looking at is not the real thing — how far off it is.
function syncFitChrome(): void {
  // An option that would show the same picture is not an option. A crop bigger
  // than the stage is already capped, so enlarging offers nothing; a frame
  // already down at the floor cannot usefully shrink. Each one leaves the row
  // rather than sitting in it doing nothing, and when neither is on offer the
  // question itself goes away.
  const canEnlarge = view.canEnlarge();
  const canShrink = view.canShrink();

  // A view can also stop being available underneath you — a new output size, a
  // resized stage — and leaving you standing in one that no longer exists would
  // light nothing in the control. True size is always there, so it is the way
  // back.
  let current = view.getFrameView();
  if ((current === 'fit' && !canEnlarge) || (current === 'small' && !canShrink)) {
    view.setFrameView('true');
    current = 'true';
  }
  const percent = Math.round(view.getFrameScale() * 100);
  $('#viewMode').hidden = !hasImage || !framingRoom() || (!canEnlarge && !canShrink);
  for (const option of $$<HTMLButtonElement>('#viewMode [role="radio"]')) {
    const value = option.dataset.view ?? 'true';
    option.setAttribute('aria-checked', String(value === current));
    option.hidden = value === 'fit' ? !canEnlarge : value === 'small' ? !canShrink : false;
  }

  // True size is a claim about the screen, so it has to be withdrawn when the
  // stage is too small to honour it — that is the one case where the view you
  // picked and the thing you are seeing are not the same.
  const capped = current === 'true' && percent < 100;
  const chip = $('#scaleChip');
  chip.hidden = current === 'true' && !capped;
  chip.classList.toggle('warn', capped);
  // Enlarging only has somewhere to go while the crop is smaller than the
  // stage; past that the stage is the limit in both views and they show the
  // same picture, which is worth saying rather than leaving you to click back
  // and forth looking for the difference.
  chip.textContent = current === 'fit'
    ? percent > 100
      ? `Enlarged — ${percent}% of true size`
      : `As large as the stage allows — ${percent}% of true size`
    : current === 'small'
      ? `Standing back — ${percent}% of true size`
      : capped ? `Too big for the stage — shown at ${percent}% of true size` : '';
}

// ---- zoom ------------------------------------------------------------------

// Zoom is a quantity, so it gets a control that can express one. The slider is
// logarithmic — every step is the same proportion of where you already are, so
// it is as fine at 700% as at 101% and there are no jumps anywhere along it —
// and the field is for when you already know the number.
const ZOOM_TICKS = 1000;
const zoomSlider = $<HTMLInputElement>('#zoomSlider');
const zoomField = $<HTMLInputElement>('#zoomValue');

// The range runs either side of 100% now — out to a picture sitting inside the
// frame, in to eight times it — so the slider is anchored at both ends rather
// than at 1 and a ceiling.
const zoomRange = (): ZoomRange => ({ min: view.getMinZoom(), max: view.getMaxZoom() });
const tickToZoom = (tick: number): number => zoomFromTick(tick, ZOOM_TICKS, zoomRange());
const zoomToTick = (zoom: number): number => tickFromZoom(zoom, ZOOM_TICKS, zoomRange());

// Whole numbers most of the time, a tenth when the tenth is the point.
const showPercent = (zoom: number): string => {
  const percent = Math.round(zoom * 1000) / 10;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
};

// The zoom can move without the control being touched — wheel, pinch, a new
// image, a change of size — so the control is refreshed from the viewfinder
// every frame rather than only when it is the thing that caused the change.
// Whatever has focus is being typed or dragged, and is left alone.
function syncZoom(): void {
  const zoom = view.getZoom();
  const focused = document.activeElement;
  if (focused !== zoomSlider) zoomSlider.value = String(zoomToTick(zoom));
  if (focused !== zoomField) zoomField.value = showPercent(zoom);
}

zoomSlider.addEventListener('input', () => {
  view.setZoom(tickToZoom(Number(zoomSlider.value)));
});

// Enter and leaving the field are the same act: take the number if it is one,
// and say what actually happened by writing the landed value back.
function commitTypedZoom(): void {
  const typed = Number.parseFloat(zoomField.value.replace(/[^\d.]/g, ''));
  if (Number.isFinite(typed)) view.setZoom(typed / 100);
  zoomField.value = showPercent(view.getZoom());
  zoomSlider.value = String(zoomToTick(view.getZoom()));
}
zoomField.addEventListener('change', commitTypedZoom);
// syncZoom leaves a focused field alone, so the zoom can move underneath it
// while you are in there. Leaving is the moment to catch up.
zoomField.addEventListener('blur', () => { zoomField.value = showPercent(view.getZoom()); });
zoomSlider.addEventListener('blur', () => { zoomSlider.value = String(zoomToTick(view.getZoom())); });
zoomField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); commitTypedZoom(); canvas.focus(); }
});
$('#zoomIn').addEventListener('click', () => view.zoomBy(1.1));
$('#zoomOut').addEventListener('click', () => view.zoomBy(1 / 1.1));

const VIEW_NAMES: Readonly<Record<FrameView, string>> = {
  small: 'Standing back',
  true: 'True size',
  fit: 'Enlarged for editing',
};

// Picking a view is not the same act as flipping between them: the radio says
// which one it wants and asking for the one you are in is nothing at all.
function setViewMode(next: FrameView): void {
  if (view.getFrameView() === next) return;
  view.setFrameView(next);
  syncFitChrome();
  announce(VIEW_NAMES[next]);
}

// The f key is a cycle, because a key has no side to press — and with three
// views there is no side to press toward either. Views that would show the same
// picture are stepped over rather than landed on, so the key never appears to
// do nothing.
function cycleView(): void {
  const order: readonly FrameView[] = ['small', 'true', 'fit'];
  const available = order.filter((v) =>
    v === 'true' || (v === 'fit' ? view.canEnlarge() : view.canShrink()));
  const at = available.indexOf(view.getFrameView());
  const next = available[(at + 1) % available.length];
  if (next) setViewMode(next);
}

// ---- intake ----------------------------------------------------------------

let loadingGeneration = 0;
let loadingFrame = 0;
let loadingCompleted = 0;
let loadingTotal = 1;
let loadingFileStarted = 0;
let loadingShown = 0;

function showLoadingProgress(fraction: number): void {
  loadingShown = Math.max(loadingShown, fraction);
  const percent = Math.max(0, Math.min(100, Math.round(loadingShown * 100)));
  $('#loadingFill').style.width = `${percent}%`;
  $('#loadingPercent').textContent = `${percent}%`;
  $('#loadingBar').setAttribute('aria-valuenow', String(percent));
}

function animateLoading(generation: number): void {
  if (generation !== loadingGeneration || !loadingActive) return;
  // Browsers do not expose decode/resize byte progress. Completed files are
  // exact; within the current file this approaches, but never reaches, its end
  // until decode and preview preparation actually resolve.
  const elapsed = performance.now() - loadingFileStarted;
  const withinFile = 0.88 * (1 - Math.exp(-elapsed / 1_350));
  showLoadingProgress((loadingCompleted + withinFile) / loadingTotal);
  loadingFrame = requestAnimationFrame(() => animateLoading(generation));
}

async function beginLoading(count: number): Promise<number> {
  const generation = ++loadingGeneration;
  if (loadingFrame) cancelAnimationFrame(loadingFrame);
  loadingActive = true;
  loadingCompleted = 0;
  loadingTotal = Math.max(1, count);
  loadingFileStarted = performance.now();
  loadingShown = 0;
  $('#loadingTitle').textContent = count === 1 ? 'Preparing image' : `Preparing ${count} images`;
  $('#loadingDetail').textContent = count === 1
    ? 'Reading the file and building a smooth editing preview.'
    : 'Preparing the stack one image at a time to keep the app responsive.';
  $('#emptyDefault').hidden = true;
  $('#loading').hidden = false;
  $('#empty').hidden = false;
  showLoadingProgress(0.02 / loadingTotal);
  loadingFrame = requestAnimationFrame(() => animateLoading(generation));
  // Guarantee the acknowledgement paints before any large decode begins.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return generation;
}

function markFilePrepared(generation: number): void {
  if (generation !== loadingGeneration) return;
  loadingCompleted = Math.min(loadingTotal, loadingCompleted + 1);
  loadingFileStarted = performance.now();
  showLoadingProgress(Math.min(0.96, loadingCompleted / loadingTotal));
}

async function endLoading(generation: number, success: boolean): Promise<void> {
  if (generation !== loadingGeneration) return;
  if (loadingFrame) cancelAnimationFrame(loadingFrame);
  loadingFrame = 0;
  if (success) {
    showLoadingProgress(1);
    $('#loadingDetail').textContent = 'Ready.';
    await new Promise<void>((resolve) => setTimeout(resolve, 160));
    if (generation !== loadingGeneration) return;
  }
  loadingActive = false;
  $('#loading').hidden = true;
  $('#emptyDefault').hidden = hasImage;
  syncStageChrome();
  // The picture has arrived and the size is still unanswered, so the question
  // is asked at once rather than waiting behind a click: the search opens,
  // focused, and typing "facebook cover" is the next thing you do. Closing it
  // leaves the stage's prompt as the way back. Batch asks through its own card,
  // and once a size is chosen later images keep it and nothing pops up.
  if (success && sizeUnanswered() && $('#coach').hidden && !sizePicker.isOpen()) sizePicker.open();
}

// Every way an image can arrive — drop, paste, file picker — comes through
// here. One image lands without questions; several are already a deliberate
// statement that they share a destination, so Batch asks for that shared size
// while its bounded previews prepare in the background.
async function intake(fileList: FileList | readonly File[]): Promise<void> {
  const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
  if (!files.length) { announce('No images in that drop'); return; }
  // A drop in Convert joins the list and stays in Convert (DEC-07): the files
  // are the job, so there is no batch to enter and no frame to set. Choosing
  // Batch from here still opens Batch with what was picked.
  if (room === 'convert' && !awaitingBatchSize) { await intakeForConvert(files); return; }
  // A new intake supersedes an unfinished automatic Batch choice. This mainly
  // protects paste and programmatic file selection, which can still arrive
  // while a pointer-modal is on screen.
  if (!$('#coach').hidden) closeCoach(false);
  const automaticBatch = room !== 'batch' && files.length > 1 && !awaitingBatchSize;
  const loading = await beginLoading(files.length);
  try {

  // The Batch decision is available from the FileList itself. Put its modal on
  // screen now, before decode, so the size decision and queue preparation can
  // proceed independently instead of making one wait visibly for the other.
  if (automaticBatch) openCoach(files.length);

  // A stack is a statement that these images share a destination, which is the
  // one thing Freeform does not have. The drop is the deliberate act (DEC-04),
  // so it wins and the preset comes back with it.
  if (files.length > 1 && isFreeform()) {
    setFreeform(false);
    showNotice('Freeform turned off — a stack needs one output size.');
  }

  // Decode one source at a time. Each large original is reduced to its bounded
  // editing preview before the next begins, so a 50-image drop never becomes a
  // 50-way decode storm or keeps fifty full pixel buffers resident.
  let items: CropItem[] = [];
  for (const file of files) {
    try {
      const maxEdge = files.length > 1 ? QUEUE_PREVIEW_MAX_EDGE : EDIT_PREVIEW_MAX_EDGE;
      items.push(createItem(file, await decodeImage(file, maxEdge)));
    } catch {
      // Keep accepting the rest of a mixed drop; the existing empty-result
      // message below covers a queue in which nothing could be decoded.
    }
    markFilePrepared(loading);
    if (automaticBatch) noteCoachPrepared();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  if (loading !== loadingGeneration) return;
  if (!items.length) {
    await endLoading(loading, false);
    if (automaticBatch) closeCoach(false);
    announce('None of those images could be opened');
    return;
  }

  // Nobody has said what size they need yet, and the image itself is the best
  // answer to that question: its own pixels, nothing cut. Guessing a square
  // meant every unasked-for arrival was cropped before it was even looked at.
  // The size stays provisional, so choosing a real one is still one click away.
  const first = items[0];
  if (isFreeform() && first) {
    const source = sourceDimensions(first.image);
    applyFreeformSize(source.width, source.height);
  }
  else if (!sizeChosen) adoptImageSize(items[0]);

  // Transparency arrived with the picture, so it should leave with it: a JPEG
  // default would quietly flatten it onto white.
  if (items.some((item) => alphaOf(item.image).transparent) && exportPanel?.keepAlpha()) {
    showNotice('Switched to PNG to keep the transparency.');
  }

  const s = store.get();
  items = items.map((item) => suggestFrame(item, s.target));
  // The lead image is the one the target was taken from, so it is the whole
  // rectangle exactly — said outright rather than rounded to by the autoframer.
  if (!sizeChosen || isFreeform()) {
    const lead = items[0];
    if (lead) items[0] = { ...lead, frame: wholeFrame(lead), framedFor: targetKey(s.target) };
  }

  // A stack chosen by going to Batch is the answer to "which images", so it is
  // the queue — and the room opens now, on the images, rather than the moment
  // the control was touched. One image chosen this way is a stack of one and
  // still opens the room; the door was walked through on purpose.
  if (awaitingBatchSize) {
    awaitingBatchSize = false;
    enterBatchWith(items);
    await endLoading(loading, true);
    announce(`${items.length} image${items.length === 1 ? '' : 's'} ready to frame`);
    // The one question left is the size they all have to come out at, asked now
    // by the control that answers it rather than left as a sentence to find.
    sizePicker.open();
    return;
  }

  // A stack is its own answer to the question the app used to ask (DEC-04):
  // dropping twelve files is the deliberate act, so it is honoured rather than
  // queried. Entering this way is never silent — the explainer says what the
  // room asks of you, once, because you did not ask to be in it.
  if (automaticBatch) {
    enterBatchWith(items, false);
    await endLoading(loading, true);
    finishCoachPreparation(items.length);
    announce(`${items.length} images ready. Choose their output size, then start framing`);
    return;
  }

  // Outside Batch a drop is a replacement, not an append: the new image takes
  // the stage and every setting stays exactly where it was (DEC-04).
  if (room !== 'batch') {
    const replaced = s.items.length > 0;
    const kept = items[0];
    store.set({ items: [kept], activeIndex: -1 });
    activate(0);
    await endLoading(loading, true);
    announce(replaced ? `Replaced with ${kept.file.name}` : `${kept.file.name} loaded`);
    return;
  }

  const firstNew = s.items.length;
  store.set({ items: [...s.items, ...items] });
  activate(s.activeIndex < 0 ? firstNew : s.activeIndex);
  await endLoading(loading, true);
  announce(`${items.length} image${items.length === 1 ? '' : 's'} added`);
  } catch {
    await endLoading(loading, false);
    if (automaticBatch) closeCoach(false);
    announce('That image could not be prepared');
  }
}

// Convert's intake. Files are read one at a time and join the list as each
// one is ready, so the first rows appear at once and a three-hundred-file drop
// is a table filling in rather than a progress bar in front of an empty one.
// Previews are thumbnail-sized: Convert re-reads every original when it
// writes, and nothing here needs more than a row's worth of picture.
const CONVERT_PREVIEW_MAX_EDGE = 256;
let convertReading = 0;

async function intakeForConvert(files: readonly File[]): Promise<void> {
  convertReading += files.length;
  convertPanel?.setReading(convertReading);
  let added = 0;
  let pending: CropItem[] = [];
  let flushed = performance.now();

  const flush = (): void => {
    if (!pending.length) return;
    const state = store.get();
    const empty = state.items.length === 0;
    const first = pending[0];
    // The crop still wants a sensible size to open on if someone goes there
    // next, and the first image is the best answer while nobody has chosen.
    if (empty && first && !sizeChosen && !isFreeform()) adoptImageSize(first);
    const target = store.get().target;
    const framed = pending.map((item) => suggestFrame(item, target));
    if (empty && framed[0] && (!sizeChosen || isFreeform())) {
      framed[0] = { ...framed[0], frame: wholeFrame(framed[0]), framedFor: targetKey(target) };
    }
    pending = [];
    store.set({ items: [...store.get().items, ...framed] });
    if (store.get().activeIndex < 0) activate(0, false);
    flushed = performance.now();
  };

  for (const file of files) {
    try {
      pending.push(createItem(file, await decodeImage(file, CONVERT_PREVIEW_MAX_EDGE)));
      added += 1;
    } catch {
      announce(`${file.name} could not be opened`);
    }
    convertReading -= 1;
    convertPanel?.setReading(convertReading);
    // Rows land in small groups: often enough to watch the list grow, rarely
    // enough that three hundred files are not three hundred re-renders.
    if (pending.length >= 24 || performance.now() - flushed > 250) flush();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  flush();
  announce(added
    ? `${added} file${added === 1 ? '' : 's'} added to convert`
    : 'None of those images could be opened');
}

/** Take files off the list, keeping the crop's picture if it is still on it. */
function removeItems(ids: readonly string[]): void {
  const gone = new Set(ids);
  const state = store.get();
  const current = activeItem(state);
  const items = state.items.filter((item) => !gone.has(item.id));
  if (items.length === state.items.length) return;
  if (!items.length) {
    store.set({ items: [], activeIndex: -1 });
    setChromeVisible(false);
    announce('List cleared');
    return;
  }
  const kept = current ? items.findIndex((item) => item.id === current.id) : -1;
  store.set({ items, activeIndex: kept });
  if (kept < 0) activate(0, false);
  announce(`${state.items.length - items.length} removed`);
}

// Set while a deliberate entry into Batch is waiting for its images: the flow is
// pick the stack, then the size, then frame — one question at a time, each one
// asked by the thing that answers it.
let awaitingBatchSize = false;

// Entering Batch is the act of choosing a stack, and until a stack exists there
// is no room to be in. This is the only path that turns the queue on.
function enterBatchWith(items: readonly CropItem[], promote = true): void {
  room = 'batch';
  store.set({ batch: true, items, activeIndex: -1 });
  activate(0, promote);
  syncStageChrome();
  syncUI();
}

// Take the output size from the picture while the size is still provisional.
function adoptImageSize(item: CropItem): void {
  const source = sourceDimensions(item.image);
  applyTarget({
    w: source.width,
    h: source.height,
    name: 'This image',
  }, false);
}

let activeEditingImage: HTMLImageElement | null = null;
let activeEditingItemId: string | null = null;
let activationGeneration = 0;

const displayImage = (item: CropItem): HTMLImageElement =>
  activeEditingImage && activeEditingItemId === item.id ? activeEditingImage : item.image;

function promoteActiveImage(generation = activationGeneration): void {
  const item = activeItem();
  if (!item) return;
  const sourceSize = sourceDimensions(item.image);
  const editingSize = previewDimensions(sourceSize.width, sourceSize.height, EDIT_PREVIEW_MAX_EDGE);
  if (item.image.naturalWidth >= editingSize.width && item.image.naturalHeight >= editingSize.height) return;
  void decodeEditingImage(item.file).then((editing) => {
    const current = activeItem();
    if (generation !== activationGeneration || current?.id !== item.id) {
      editing.src = '';
      return;
    }
    activeEditingImage = editing;
    activeEditingItemId = item.id;
    view.setImage(editing, current.frame);
  }).catch(() => {
    // The queue-sized preview is already usable; promotion is an enhancement.
  });
}

function activate(index: number, promote = true): void {
  const generation = ++activationGeneration;
  if (activeEditingImage) activeEditingImage.src = '';
  activeEditingImage = null;
  activeEditingItemId = null;
  const state = store.get();
  const source = state.items[index];
  if (!source) return;
  const framed = fitFrameToTarget(source, state.target);
  store.transact((current) => ({
    ...current,
    activeIndex: index,
    items: current.items.map((item) => item.id === framed.id ? framed : item),
  }));
  const item = activeItem();
  if (!item) return;
  showFileIdentity(item);
  setChromeVisible(true);
  view.setImage(item.image, item.frame);
  showAdjust(item);
  syncUI();
  strip.scrollToActive(store.get());
  canvas.focus();

  if (promote) promoteActiveImage(generation);
}

// ---- approval --------------------------------------------------------------

// The filmstrip and the export panel both describe the same queue, so they are
// always refreshed together.
function syncUI(): void {
  strip.sync(store.get());
  // Where you are in the queue is part of the same description.
  syncFramingChrome();
  // The scale row states the pixels that would be written right now, so it is
  // refreshed with everything else that describes the pending export.
  exportPanel?.sync();
}

const strip = createFilmstrip({
  root: $('#strip'),
  rail: $('#stripRail'),
  bar: $('#progressBar'),
  text: $('#progressText'),
  empty: $('#stripEmpty'),
  approveAll: $('#approveAll'),
  onActivate: activate,
  onApproveAll: approveRest,
  onAdd: () => openPicker(),
});

// Keeping a crop is the beat of the whole batch, and it happens on the picture
// rather than in a sentence somewhere: the frame flashes the app's one accent
// and the thumbnail lights up as the next image arrives.
function flashKept(): void {
  stage.classList.remove('just-kept');
  void stage.offsetWidth;
  stage.classList.add('just-kept');
}

function approve(): void {
  const item = activeItem();
  if (!item) return;
  store.updateItem(item.id, (current) => (acceptFrame(current)));
  syncUI();
  flashKept();
  strip.celebrate(store.get());

  const s = store.get();
  const next = s.items.findIndex((i, idx) => !i.approved && idx > s.activeIndex);
  const wrapped = next >= 0 ? next : s.items.findIndex((i) => !i.approved);
  if (wrapped >= 0) {
    activate(wrapped);
    announce(`Kept. ${s.items.filter((i) => i.approved).length} of ${s.items.length} framed`);
  } else {
    syncUI();
    flashExport();
    announce(`All ${s.items.length} framed and ready`);
  }
}

// The queue is finished, so the thing that was dim all the way through is now
// the only thing left to do. Say so where the eye already is.
function flashExport(): void {
  // On a phone the export button is inside a screen you have not opened yet, so
  // the thing that opens it is what has to catch the eye. Whichever is on
  // screen, the finished queue points at the one thing left to do.
  const button = narrow() ? $('#sheetOpen') : $('#export');
  button.classList.remove('just-ready');
  void button.offsetWidth;
  button.classList.add('just-ready');
}

// Accept every remaining auto-suggested crop as-is.
function approveRest(): void {
  const state = store.transact((current) => ({
    ...current,
    items: current.items.map((item) => {
      if (item.approved) return item;
      return acceptFrame(fitFrameToTarget(item, current.target));
    }),
  }));
  syncUI();
  flashExport();
  announce(`All ${state.items.length} framed and ready`);
}

function step(delta: number): void {
  const s = store.get();
  if (s.items.length < 2) return;
  activate((s.activeIndex + delta + s.items.length) % s.items.length);
}

// ---- target size -----------------------------------------------------------

interface TargetSelection { readonly w: number; readonly h: number; readonly name: string; }

// What the panel says about the chosen size. Split out of applyTarget because
// undo restores a target that was never re-applied — it only has to be shown.
function showTarget(target: OutputTarget): void {
  // The card answers the size question out loud: what it is called, the pixels,
  // and the shape they make. The name used to be read only by screen readers,
  // which left sighted people to recognise "1200 × 627" as a LinkedIn post.
  $('#sizeName').textContent = target.label;
  $('#sizeDims').textContent = `${target.w} × ${target.h}`;
  $('#sizeRatio').textContent = ratioLabel(target.w, target.h);
  // The top bar's compact half of the same control.
  $('#sizeChipDims').textContent = `${target.w} × ${target.h}`;
  // Mirror the frame's shape in the panel chip.
  const swatch = $('#sizeSwatch');
  const long = 26;
  const { w, h } = target;
  swatch.style.width = `${w >= h ? long : Math.max(6, (long * w) / h)}px`;
  swatch.style.height = `${w >= h ? Math.max(6, (long * h) / w) : long}px`;
}

// ---- pinned sizes ----------------------------------------------------------

// The size picker is a good answer to "what size?" and a poor one to "the same
// size as the last nine times". A pin is the second question's answer: the
// sizes this person actually uses, sitting in the top bar where a decision that
// is already made belongs.
function renderPins(list: readonly PinnedSize[] = loadPinned()): void {
  const host = $('#pins');
  host.textContent = '';
  host.hidden = list.length === 0;

  for (const pin of list) {
    const chip = document.createElement('span');
    chip.className = 'pin-chip';
    chip.dataset.pin = pin.id;

    // Two acts on one chip: use this size, or stop keeping it. The big half is
    // the one you want, and the ✕ has to be deliberate to hit.
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'pin-use';
    const name = document.createElement('strong');
    name.textContent = pin.name;
    const dims = document.createElement('span');
    dims.textContent = `${pin.w} × ${pin.h}`;
    use.append(name, dims);
    use.title = `${pin.name} — ${pin.w} × ${pin.h}`;
    use.addEventListener('click', () => {
      sizeChosen = true;
      applyTarget({ w: pin.w, h: pin.h, name: pin.name });
      syncSizeConfidence();
    });

    const drop = document.createElement('button');
    drop.type = 'button';
    drop.className = 'pin-drop';
    drop.textContent = '✕';
    drop.title = `Unpin ${pin.name}`;
    drop.setAttribute('aria-label', `Unpin ${pin.name}`);
    drop.addEventListener('click', () => renderPins(removePinned(pin.id)));

    chip.append(use, drop);
    host.append(chip);
  }
  markActivePin();
}

// A pin is not a mode, but it is worth saying which one you are looking at.
function markActivePin(): void {
  const { target } = store.get();
  const active = pinId(target.w, target.h);
  for (const chip of $('#pins').querySelectorAll<HTMLElement>('.pin-chip')) {
    chip.classList.toggle('is-active', chip.dataset.pin === active);
  }
}

// Everything the screen owes a new output size. The store move differs by route
// — a preset refits every crop, Freeform states one outright — but what has to
// be redrawn afterwards is the same either way.
function showAppliedTarget(target: OutputTarget, refreshActive = true): void {
  // An inferred size belongs to the image currently arriving. Put its frame in
  // the right geometry before the next paint instead of animating there from
  // the previous/default target for several seconds.
  view.setTarget(target.w, target.h, !refreshActive);
  syncFitChrome();
  showTarget(target);
  markActivePin();

  // Every queued crop follows the new shape immediately, so the filmstrip is
  // always a truthful preview of what would be exported right now.
  const item = refreshActive ? activeItem() : null;
  if (item) {
    view.setImage(displayImage(item), item.frame);
    updateReadout(view.getFraming());
  }
  syncUI();
}

function applyTarget({ w, h, name }: TargetSelection, refreshActive = true): void {
  if (!(w > 0 && h > 0)) return;
  const state = store.transact((current) => {
    const target = { w, h, label: name };
    // Naming a size is the plainest possible way of saying the crop has a
    // destination again, so it is also how you leave Freeform.
    const base = releaseFreeform(current);
    return { ...base, target, items: base.items.map((item) => fitFrameToTarget(item, target)) };
  });
  view.setFreeform(false);
  showAppliedTarget(state.target, refreshActive);
  syncFreeformChrome();
  announce(`${name}, ${w} by ${h} pixels`);
}

// ---- freeform --------------------------------------------------------------

// The preset is suspended rather than unavailable while Freeform is on, and the
// Batch room asks for a size on the way in — so neither has to be disabled and
// neither has to explain itself in a sentence nobody reads.
function syncFreeformChrome(): void {
  const on = isFreeform();
  $('#freeform').setAttribute('aria-pressed', String(on));
  $('#sizeButton').classList.toggle('is-suspended', on);
  syncSizeConfidence();
}

function setFreeform(on: boolean): void {
  if (isFreeform() === on) return;

  if (on) {
    const before = store.get();
    const framing = view.hasImage() ? view.getFraming() : null;
    const state = store.transact((current) => enterFreeform(current, framing));
    view.setFreeform(true);
    // Freeform is one image's answer, so it cannot be given in the room whose
    // whole basis is a size every image shares. Leaving is a move between
    // rooms, not a deletion: the queue is exactly where it was.
    if (room === 'batch') room = 'crop';
    showAppliedTarget(state.target);
    syncStageChrome();
    syncFreeformChrome();
    if (before.batch) showNotice('Left Batch — Freeform applies to one image.');
    announce('Freeform crop enabled. Aspect ratio unlocked');
    return;
  }

  const state = store.transact((current) => exitFreeform(current, DEFAULT_TARGET));
  view.setFreeform(false);
  showAppliedTarget(state.target);
  syncFreeformChrome();
  announce(`Freeform crop disabled. Restored ${state.target.w} by ${state.target.h} preset`);
}

// A picture arriving in Freeform has no size to inherit — the last crop's pixel
// count is a fact about a different image — so it starts as the whole of itself.
function applyFreeformSize(w: number, h: number): void {
  const state = store.set({ target: { w, h, label: FREEFORM_LABEL } });
  showAppliedTarget(state.target);
}

// Until a size has actually been chosen the panel is only showing a default.
// That used to be enforced with a modal; it is now said where the answer lives,
// so an unanswered question nags instead of blocking.
let sizeChosen = false;

// The size question is still open: a picture is in the crop room and nothing
// has answered it. That is when the picker opens by itself after a drop, and
// when a typed letter starts the search instead of acting as a shortcut. Batch
// asks through its own card (DEC-04); Adjust and Convert are not about size.
function sizeUnanswered(): boolean {
  return hasImage && !loadingActive && !sizeChosen && !isFreeform() && room === 'crop';
}

function syncSizeConfidence(): void {
  // In Freeform the size is not unsettled, it is superseded — and the way out
  // is the control itself, so that is what the line says.
  const freeform = isFreeform();
  const unsettled = !sizeChosen && !freeform;
  $('#sizeButton').classList.toggle('is-provisional', unsettled);
  $('#sizeNote').classList.toggle('is-unsettled', unsettled);
  $('#sizeNote').textContent = freeform
    ? 'Choose an output size to exit Freeform.'
    : sizeChosen
      ? 'Search by name, pixels or shape.'
      : hasImage
        ? 'Your image’s own size, nothing cropped. Click above to crop it to something else.'
      : 'Just a suggestion — click above to set the size you need.';
}

function applyPickedSize(result: SizeResult): void {
  sizeChosen = true;
  applyTarget({ w: result.w, h: result.h, name: result.name });
  // "Whole image" is a promise about the result, not just a size, so the crop
  // is stated outright rather than arrived at. The obvious route — set the
  // target, then fill the frame — cannot be trusted here: filling measures
  // against the frame rect, and that rect spends the next few hundred ms
  // animating out of the old shape, so a fill lands on an aspect belonging to
  // neither size and the file ships with bars down two edges. Export reads
  // item.frame, so naming the whole rectangle is both the truth and the thing
  // written to disk, with no animation to wait on.
  if (result.kind === 'whole') {
    const item = activeItem();
    if (item) {
      const updated = useWholeImage(item, { w: result.w, h: result.h, label: result.name });
      store.updateItem(item.id, () => updated);
      view.setImage(displayImage(updated), updated.frame);
    }
    announce(`Whole image at ${result.w} by ${result.h} pixels. Nothing cropped`);
  }
  syncSizeConfidence();
}

const sizePicker = createSizePicker({
  root: $('#picker'),
  input: $('#pickerInput'),
  list: $('#pickerList'),
  trigger: $('#sizeButton'),
  // The image on the stage is also an answer to the size question — the whole
  // "use this as the template" move, now reachable whenever it is wanted rather
  // than only in the half-second the file was arriving.
  getCurrent: () => {
    const { target } = store.get();
    return { w: target.w, h: target.h };
  },
  getTemplate: () => {
    const item = activeItem();
    if (!item) return null;
    const source = sourceDimensions(item.image);
    return { w: source.width, h: source.height };
  },
  onPinsChange: renderPins,
  // Clicking a suspended preset is one act, not two: it means "I want a size
  // again", so Freeform ends and the list opens on the same click. The preset
  // that was suspended comes back with it, so dismissing without choosing
  // leaves you exactly where the click implied — out of Freeform, on the size
  // you had before it.
  onBeforeOpen: () => { if (isFreeform()) setFreeform(false); },
  onPick: (result: SizeResult) => {
    // In automatic Batch entry, choosing is deliberately reversible until the
    // explicit confirmation. It also avoids touching every queued frame while
    // previews may still be arriving in the background.
    if (!$('#coach').hidden) {
      coachChoice = result;
      syncCoach();
      return;
    }
    applyPickedSize(result);
  },
});

// ---- export ----------------------------------------------------------------

exportPanel = createExportPanel({
  getState: () => store.get(),
  getFraming: () => view.hasImage() ? view.getFraming() : null,
  announce,
  onScaleChange: updateReadout,
  onSizeChange: (w, h) => {
    sizeChosen = true;
    applyTarget({ w, h, name: 'Custom size' });
    syncSizeConfidence();
  },
});

convertPanel = createConvertPanel({
  getState: () => store.get(),
  subscribe: (listener) => { store.subscribe(listener); },
  announce,
  onChoose: () => openPicker(),
  onRemove: removeItems,
});

// ---- history ---------------------------------------------------------------

// Undo restores a whole past state, so the screen has to be rebuilt from it
// rather than nudged: the target, the framing on the canvas, the adjustment
// sliders and the queue all describe that state and none of them can be left
// showing the one it replaced.
function showState(state: AppState): void {
  showTarget(state.target);
  view.setTarget(state.target.w, state.target.h);
  // The mode is part of the state being restored, so the lock, the button and
  // the suspended preset all come back with it rather than being left behind.
  view.setFreeform(state.cropMode === 'freeform');
  syncFreeformChrome();

  const item = state.items[state.activeIndex] ?? null;
  if (item) {
    if (activeEditingItemId && activeEditingItemId !== item.id) {
      activationGeneration += 1;
      if (activeEditingImage) activeEditingImage.src = '';
      activeEditingImage = null;
      activeEditingItemId = null;
    }
    showFileIdentity(item);
    setChromeVisible(true);
    view.setImage(displayImage(item), item.frame);
    showAdjust(item);
    updateReadout(view.getFraming());
  } else {
    setChromeVisible(false);
  }
  // The room is part of the state being restored, since the queue's presence is.
  if (state.batch !== (room === 'batch')) room = state.batch ? 'batch' : 'crop';
  syncStageChrome();
  syncFitChrome();
  syncUI();
}

const history = createHistory({
  onChange: () => {
    $<HTMLButtonElement>('#undo').disabled = !history.canUndo();
    $<HTMLButtonElement>('#redo').disabled = !history.canRedo();
  },
  onRestore: showState,
});

$('#undo').addEventListener('click', () => {
  if (history.undo()) announce('Undone');
});
$('#redo').addEventListener('click', () => {
  if (history.redo()) announce('Redone');
});

// ---- events ----------------------------------------------------------------

const openPicker = () => { fileInput.value = ''; fileInput.click(); };
$('#emptyAdd').onclick = openPicker;
fileInput.onchange = () => { if (fileInput.files) void intake(fileInput.files); };

// Dopedocs owns the documentation surface; the live workspace stays mounted.
const docsOpen = $<HTMLButtonElement>('#docsOpen');
const workspace = $<HTMLElement>('.app');
const docsPanel = mountPanel(document.body, docsContent, {
  navLabel: 'On this page',
  backLabel: 'Back to app',
  onToggle(open) {
    workspace.inert = open;
    docsOpen.setAttribute('aria-expanded', String(open));
    if (!open) {
      docsOpen.focus();
      guardAppUrl();
    }
  },
});
docsOpen.addEventListener('click', () => docsPanel.open());

// The panel mirrors the section being read into the URL and closes with
// history.back(). A scroll event that reaches its hidden pane after closing
// can rewrite the *app's* history entry to a /docs/ address, and the next
// close then lands on that entry and re-opens the panel there. So for a moment
// after closing, a /docs/ address with the panel shut is put back to the app.
function guardAppUrl(): void {
  const base = docsContent.basePath ?? '/docs';
  const started = performance.now();
  const check = (): void => {
    if (docsPanel.isOpen) return;
    if (location.pathname.startsWith(base)) window.history.replaceState(window.history.state, '', '/');
    if (performance.now() - started < 1200) requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
document.addEventListener('keydown', (event) => {
  if (docsPanel.isOpen) event.stopImmediatePropagation();
});

// The account is optional (DEC-05): a guest page never loads its service.
// Signed in, the sizes you keep travel with you; the card says how that is going.
const sizeSync = createSizeSync();
const account = createAccount({ announce, onSession: (session, client) => sizeSync.session(session, client) });
function syncNote(status: SyncStatus): string {
  switch (status.kind) {
    case 'syncing': return 'Syncing your sizes…';
    case 'synced': return status.count
      ? `Synced. ${status.count} saved and pinned ${status.count === 1 ? 'size is' : 'sizes are'} kept with this account.`
      : 'Synced. Sizes you save or pin are kept with this account.';
    case 'unavailable': return status.reason === 'offline'
      ? 'Offline. Your sizes stay on this device until you reconnect.'
      : status.reason === 'not-installed'
        ? 'Sync is not set up on the server yet. Your sizes stay on this device.'
        : 'Sync is unavailable right now. Your sizes stay on this device.';
    default: return 'Your saved and pinned sizes are kept with this account.';
  }
}
sizeSync.onStatus((status) => account.setNote(syncNote(status)));
// A copy arriving from the account redraws the top bar; the picker rereads
// storage every time it opens.
onSizesWritten((origin) => { if (origin === 'remote') renderPins(); });

let dragDepth = 0;
for (const name of ['dragenter', 'dragleave', 'dragover', 'drop'] as const) {
  document.addEventListener(name, (event) => {
    const e = event as DragEvent;
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    // A file dropped over the documentation belongs to neither the docs nor
    // the hidden workspace. Prevent browser navigation, but leave the crop as
    // it was when the reader opened this view.
    if (docsPanel.isOpen) { e.preventDefault(); return; }
    e.preventDefault();
    if (name === 'dragenter') { dragDepth++; document.body.classList.add('dragging'); }
    if (name === 'dragleave' && !--dragDepth) document.body.classList.remove('dragging');
    if (name === 'drop') {
      dragDepth = 0;
      document.body.classList.remove('dragging');
      intake(e.dataTransfer.files);
    }
  });
}

// Ctrl/Cmd+V arrives here as a paste event, wherever the focus happens to be —
// so a clipboard image takes exactly the same road as a dropped one.
document.addEventListener('paste', (e) => {
  if (docsPanel.isOpen || account.isOpen()) return;
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  intake(files);
});

// Undo is the one shortcut that has to work from anywhere and in either mode,
// so it is read before the framing keys and their guards.
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
  const focused = document.activeElement;
  if (focused && focused.matches?.('input, select, textarea')) return;
  e.preventDefault();
  const redoing = e.shiftKey;
  const moved = redoing ? history.redo() : history.undo();
  announce(moved
    ? (redoing ? 'Redone' : 'Undone')
    : (redoing ? 'Nothing to redo' : 'Nothing to undo'));
});

document.addEventListener('keydown', (e) => {
  // The target is not always an element (and not always one with .matches),
  // so ask the document what has focus instead of trusting the event.
  const focused = document.activeElement;
  if (focused && focused.matches?.('input, select, textarea')) return;
  if (!view.hasImage()) return;
  if (e.ctrlKey || e.metaKey) return;
  // The explainer is modal: Enter belongs to its button, not to the crop
  // waiting behind it.
  if (!$('#coach').hidden) {
    // Escape only backs out of the embedded palette (handled there). The Batch
    // card itself remains the gate until a shared size is confirmed.
    if (e.key === 'Escape') e.preventDefault();
    e.stopPropagation();
    return;
  }

  // Every key below moves the framing or the queue. None of them belongs to
  // adjusting, and a stray arrow that quietly re-crops the image you were only
  // trying to brighten is exactly the kind of thing that costs trust. Switching
  // job is a labelled button on the stage, deliberately not a letter to learn.
  if (!framingRoom()) return;

  // "Drop an image, type where it's going." While the size is unanswered, a
  // letter is the start of that answer rather than a shortcut, so it opens the
  // size search with the letter already in it.
  if (sizeUnanswered() && !e.altKey && e.key.length === 1 && /\S/.test(e.key)) {
    e.preventDefault();
    sizePicker.open({ query: e.key });
    return;
  }

  // Arrows fine-tune the framing; brackets (or j/k) move through the queue.
  // Nudging is the more frequent act, so it keeps the arrows.
  const px = e.shiftKey ? 40 : 8;
  const actions: Readonly<Record<string, () => void>> = {
    ArrowLeft: () => view.nudge(px, 0),
    ArrowRight: () => view.nudge(-px, 0),
    ArrowUp: () => view.nudge(0, px),
    ArrowDown: () => view.nudge(0, -px),
    '0': () => view.fill(),
    f: cycleView,
    F: cycleView,
    '=': () => view.zoomBy(1.1),
    '+': () => view.zoomBy(1.1),
    '-': () => view.zoomBy(1 / 1.1),
    Enter: approve,
    ' ': approve,
    ']': () => step(1),
    '[': () => step(-1),
    // The size search, from the keyboard, whenever the frame is the job.
    '/': () => sizePicker.open(),
    j: () => step(1),
    k: () => step(-1),
  };
  const action = actions[e.key];
  if (!action) return;
  e.preventDefault();
  action();
});

// The filmstrip appearing changes the stage height, so watch the element
// itself rather than the window.
let resizeFrame = 0;
new ResizeObserver(() => {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    view.resize();
    syncFitChrome();
  });
}).observe(stage);

for (const option of $$<HTMLButtonElement>('#viewMode [role="radio"]')) {
  option.addEventListener('click', () => setViewMode((option.dataset.view ?? 'true') as FrameView));
}
$('#freeform').addEventListener('click', () => setFreeform(!isFreeform()));
// The size question, asked from the top bar as well as from the panel.
$('#sizeChip').addEventListener('click', () => sizePicker.open());
// A live pixel count you cannot touch is a number that looks like a field and
// is not one. In Freeform the crop's size *is* the output size, so tapping it
// asks the only question it could be asking: make this an exact size instead.
$('#cropChip').addEventListener('click', () => { if (isFreeform()) sizePicker.open(); });
// The button, its narrow-layout twin and the Enter key are one act.
$('#finalize').addEventListener('click', approve);
$('#finalizeSmall').addEventListener('click', approve);
$('#coachSize').addEventListener('click', openCoachPicker);
$('#coachConfirm').addEventListener('click', () => {
  if (!coachChoice || !coachReady) return;
  applyPickedSize(coachChoice);
  closeCoach();
  announce(`${coachTotal} images ready to frame at ${coachChoice.w} by ${coachChoice.h} pixels`);
});
$('#modeCrop').addEventListener('click', () => goTo('crop'));
$('#modeAdjust').addEventListener('click', () => goTo('adjust'));
$('#modeConvert').addEventListener('click', () => goTo('convert'));
$('#modeBatch').addEventListener('click', () => goTo('batch'));

// ---- boot ------------------------------------------------------------------

paintIcons();
// The size card's shortcut, in the words of the keyboard in front of you.
if (/Mac|iPhone|iPad/.test(navigator.platform)) {
  for (const key of $$<HTMLElement>('.size-key')) key.textContent = '⌘K';
}
renderPins();
setChromeVisible(false);
syncFreeformChrome();
syncUI();
const boot = store.get().target;
applyTarget({ w: boot.w, h: boot.h, name: boot.label });
syncSizeConfidence();
view.resize();
