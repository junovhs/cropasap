// The Convert room: its choices in the right-hand panel, its files on the stage.
//
// The question this room answers is "what will I get, and is it worth it?". So
// it states the trade in both directions and does not flatter the result: a
// JPEG converted to PNG gets bigger, and the row says so in the same voice it
// uses for a saving. A converter that only ever reports good news is one you
// stop believing.
//
// The surface is small on purpose (DEC-12): one choice of format and one
// button. Quality and a size limit are one disclosure away, and the summary on
// that disclosure always says what they are set to, so opening it is never the
// only way to find out why a number changed.

import { FORMATS, DEFAULT_TEMPLATE } from '../export.js';
import { convertAndDownload, convertOne, planFor, readableBytes, SizeBudgetError } from '../convert.js';
import { requiredElement, requiredElements } from '../infrastructure/dom.js';
import { sourceDimensions } from '../infrastructure/image-decoder.js';
import { createConvertTable, type ConvertRowView, type RowTone } from './convert-table.js';
import type { AppState, CropItem, ExportFormat } from '../domain/types.js';

// Long enough that dragging the quality slider does not queue an encode per
// frame, short enough that the estimate feels like it belongs to the control.
const ESTIMATE_DELAY = 220;
const DEFAULT_QUALITY = 86;

export interface ConvertPanelOptions {
  readonly root?: ParentNode;
  readonly getState: () => AppState;
  readonly subscribe: (listener: (state: AppState) => void) => void;
  readonly announce: (message: string) => void;
  readonly onChoose: () => void;
  readonly onRemove: (ids: readonly string[]) => void;
}

export interface ConvertPanelController {
  /** The room was entered or left; only an open room spends time measuring. */
  setActive(active: boolean): void;
  /** Files still being read in, shown on the table while they arrive. */
  setReading(count: number): void;
  sync(): void;
}

type Estimate =
  | { readonly state: 'measuring' }
  | { readonly state: 'ok'; readonly bytes: number }
  | { readonly state: 'error'; readonly message: string; readonly budget?: SizeBudgetError };

/** "PNG", "WebP", "SVG" — the container as a person names it. */
function kindOf(file: File): string {
  const known = Object.values(FORMATS).find((descriptor) => descriptor.mime === file.type);
  if (known) return known.label;
  const sub = file.type.split('/')[1] ?? '';
  const name = sub.replace(/\+xml$/, '').replace(/^x-/, '').replace(/^vnd\.microsoft\.icon$/, 'ico');
  return (name || file.name.split('.').pop() || 'image').toUpperCase();
}

const percent = (from: number, to: number): { readonly text: string; readonly tone: RowTone } => {
  if (!from) return { text: '', tone: 'neutral' };
  const ratio = to / from;
  if (Math.abs(ratio - 1) < 0.005) return { text: 'Same size', tone: 'neutral' };
  return ratio < 1
    ? { text: `−${Math.round((1 - ratio) * 100)}%`, tone: 'better' }
    : { text: `+${Math.round((ratio - 1) * 100)}%`, tone: 'worse' };
};

export function createConvertPanel({
  root = document,
  getState,
  subscribe,
  announce,
  onChoose,
  onRemove,
}: ConvertPanelOptions): ConvertPanelController {
  const $ = <T extends Element = HTMLElement>(selector: string): T => requiredElement<T>(selector, root);
  const $$ = <T extends Element = HTMLElement>(selector: string): T[] => requiredElements<T>(selector, root);

  let format: ExportFormat = 'webp';
  let quality = DEFAULT_QUALITY / 100;
  let active = false;
  let converting = false;
  let reading = 0;
  let outcome: string | null = null;
  // What the last conversion wrote, by row key, so a row can say "Converted"
  // until something about it changes.
  const converted = new Set<string>();
  const overrides = new Map<string, ExportFormat>();
  const estimates = new Map<string, Estimate>();
  let estimating = false;
  let estimateTimer: ReturnType<typeof setTimeout> | null = null;
  let renderFrame = 0;

  const button = $<HTMLButtonElement>('#convertGo');
  const buttonLabel = $<HTMLElement>('#convertGoLabel');
  const fill = $<HTMLElement>('#convertFill');
  const sourceLine = $<HTMLElement>('#convertSource');
  const resultLine = $<HTMLElement>('#convertResult');
  const noteLine = $<HTMLElement>('#convertNote');
  const more = $<HTMLDetailsElement>('#convertMore');
  const moreSummary = $<HTMLElement>('#convertMoreSummary');
  const qualityInput = $<HTMLInputElement>('#convertQuality');
  const qualityValue = $<HTMLElement>('#convertQualityValue');
  const budgetInput = $<HTMLInputElement>('#convertBudget');
  const smallestButton = $<HTMLButtonElement>('#convertSmallest');

  const items = (): readonly CropItem[] => getState().items;
  const budgetBytes = (): number | undefined =>
    budgetInput.value !== '' && budgetInput.validity.valid ? Number(budgetInput.value) * 1000 : undefined;
  const validBudget = (): boolean => budgetInput.validity.valid;
  const formatFor = (item: CropItem): ExportFormat => overrides.get(item.id) ?? format;
  const planOf = (item: CropItem) => planFor(item, { format, targetBytes: budgetBytes(), formatFor });
  const keyOf = (item: CropItem): string => {
    const plan = planOf(item);
    const q = FORMATS[plan.format].lossy && plan.targetBytes === undefined ? quality : 0;
    return `${item.id}|${plan.format}|${q}|${plan.targetBytes ?? ''}`;
  };

  const table = createConvertTable({
    root: $('#convertTable'),
    onChoose,
    onRemove: (id) => onRemove([id]),
    onClear: () => onRemove(items().map((item) => item.id)),
    onOverride: (id, next) => {
      if (next === null || next === format) overrides.delete(id); else overrides.set(id, next);
      scheduleRender();
      kick();
    },
    onVisible: () => kick(),
  });

  // ---- estimating ---------------------------------------------------------

  /**
   * The next file worth measuring: one on screen first, then the rest in
   * order. Every file is measured eventually, because the summary is a total;
   * the ones being looked at are simply measured first.
   */
  function nextToMeasure(): CropItem | null {
    const queue = items();
    const visible = table.visibleIds();
    let fallback: CropItem | null = null;
    for (const item of queue) {
      if (estimates.has(keyOf(item))) continue;
      if (visible.has(item.id)) return item;
      fallback ??= item;
    }
    return fallback;
  }

  /**
   * One file at a time, one yield between each. Encoding is asynchronous and
   * decoding happens off the main thread, so the page keeps answering input
   * while three hundred rows fill in behind it.
   */
  async function measure(): Promise<void> {
    if (estimating) return;
    estimating = true;
    try {
      while (active && !converting && validBudget()) {
        const item = nextToMeasure();
        if (!item) break;
        const key = keyOf(item);
        const plan = planOf(item);
        estimates.set(key, { state: 'measuring' });
        scheduleRender();
        try {
          const blob = await convertOne(item, { format: plan.format, quality, targetBytes: plan.targetBytes }, undefined, true);
          estimates.set(key, { state: 'ok', bytes: blob.size });
        } catch (error: unknown) {
          estimates.set(key, error instanceof SizeBudgetError
            ? { state: 'error', message: `Can’t fit under ${readableBytes(plan.targetBytes ?? 0)}`, budget: error }
            : { state: 'error', message: error instanceof Error ? error.message : 'Could not encode that format' });
        }
        scheduleRender();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      estimating = false;
    }
  }

  function kick(): void {
    if (estimateTimer !== null) clearTimeout(estimateTimer);
    estimateTimer = null;
    if (active && !converting) void measure();
  }

  function kickSoon(): void {
    if (estimateTimer !== null) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(kick, ESTIMATE_DELAY);
  }

  // ---- drawing ------------------------------------------------------------

  function scheduleRender(): void {
    if (renderFrame || !active) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      render();
    });
  }

  function rowOf(item: CropItem): ConvertRowView {
    const { width: w, height: h } = sourceDimensions(item.image);
    const plan = planOf(item);
    const key = keyOf(item);
    const label = FORMATS[plan.format].label;
    const estimate = estimates.get(key);
    const from = item.file.size;
    const now = `${kindOf(item.file)} · ${w} × ${h} · ${readableBytes(from)}`;
    const overridden = overrides.has(item.id);

    let becomes = `${label} · …`;
    let change = { text: '', tone: 'neutral' as RowTone };
    let status = 'Waiting';
    let statusTone: RowTone = 'neutral';
    if (estimate?.state === 'measuring') status = 'Measuring…';
    if (estimate?.state === 'ok') {
      becomes = `${label} · ${plan.format === 'png' ? '≤ ' : '≈ '}${readableBytes(estimate.bytes)}`;
      change = percent(from, estimate.bytes);
      status = 'Ready';
    }
    if (estimate?.state === 'error') {
      becomes = label;
      status = estimate.message;
      statusTone = 'worse';
    }
    if (converted.has(key)) { status = 'Converted'; statusTone = 'better'; }

    const how = plan.targetBytes !== undefined
      ? `the best quality that fits under ${readableBytes(plan.targetBytes)}`
      : FORMATS[plan.format].lossy ? `quality ${Math.round(quality * 100)}` : 'no quality loss';
    const bytes = estimate?.state === 'ok' ? `about ${estimate.bytes.toLocaleString()} bytes` : 'size not measured yet';
    const detail = `${item.file.name}: ${from.toLocaleString()} bytes now. As ${label} at ${how}, ${bytes}. `
      + `Stays ${w} × ${h} pixels.`;

    return {
      item, now, becomes, change: change.text, tone: change.tone, status, statusTone,
      losses: [], format: plan.format, overridden, detail,
    };
  }

  function render(): void {
    const queue = items();
    const rows = queue.map(rowOf);
    const fromBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
    const measured = queue.map((item) => estimates.get(keyOf(item)));
    const done = measured.filter((e): e is Extract<Estimate, { state: 'ok' }> => e?.state === 'ok');
    const failed = measured.filter((e): e is Extract<Estimate, { state: 'error' }> => e?.state === 'error');
    const count = queue.length;
    const files = `${count} file${count === 1 ? '' : 's'}`;

    table.render({
      rows,
      reading,
      busy: converting,
      summary: reading
        ? `Reading ${reading} more file${reading === 1 ? '' : 's'}…${count ? ` · ${files} ready` : ''}`
        : `${files} · ${readableBytes(fromBytes)}`,
    });

    // The panel's one sentence: the whole job, before and after.
    sourceLine.textContent = count ? `${files} · ${readableBytes(fromBytes)} now` : 'No files yet.';
    resultLine.classList.remove('is-worse');
    if (!count) {
      resultLine.textContent = '';
    } else if (!validBudget()) {
      resultLine.textContent = 'Enter a whole number of KB, or leave the limit empty.';
      resultLine.classList.add('is-worse');
    } else if (failed.length) {
      resultLine.textContent = `${failed.length} of ${count} can’t be converted as set — see the table.`;
      resultLine.classList.add('is-worse');
    } else if (done.length < count) {
      resultLine.textContent = `Measuring ${done.length + 1} of ${count}…`;
    } else {
      const toBytes = done.reduce((sum, e) => sum + e.bytes, 0);
      const trade = percent(fromBytes, toBytes);
      const words = trade.tone === 'better' ? `${trade.text.slice(1)} smaller`
        : trade.tone === 'worse' ? `${trade.text.slice(1)} bigger` : 'about the same';
      resultLine.textContent = `Becomes ≈ ${readableBytes(toBytes)} — ${words}`;
      resultLine.classList.toggle('is-worse', trade.tone === 'worse');
    }

    const firstBudget = failed.find((e) => e.budget)?.budget ?? null;
    smallestButton.hidden = !firstBudget || converting;
    if (firstBudget) {
      smallestButton.textContent = `Use quality ${Math.round(firstBudget.quality * 100)} without a limit`;
      smallestButton.dataset.quality = String(Math.round(firstBudget.quality * 100));
    }

    button.disabled = !count || converting || reading > 0 || !validBudget();
    if (!button.classList.contains('is-done')) {
      buttonLabel.textContent = converting ? 'Converting…' : count > 1 ? `Convert ${count} files` : 'Convert';
    }
    noteLine.textContent = outcome ?? (!count
      ? 'Drop images anywhere to add them.'
      : count > 1 ? 'Downloads as one ZIP. Every image keeps its pixel size.'
      : 'Downloads as a single file. The image keeps its pixel size.');

    for (const option of $$<HTMLButtonElement>('#convertFormatGroup button')) option.disabled = converting;
    budgetInput.disabled = converting;
    qualityInput.disabled = converting || budgetBytes() !== undefined;
    qualityValue.textContent = budgetBytes() !== undefined ? 'Auto' : qualityInput.value;
    describeMore();
  }

  /** The disclosure's own label says what is inside it is set to (DEC-12 rule 4). */
  function describeMore(): void {
    const lossy = FORMATS[format].lossy;
    more.hidden = !lossy;
    const budget = budgetBytes();
    const q = Math.round(quality * 100);
    moreSummary.textContent = budget !== undefined
      ? `Under ${readableBytes(budget)} each`
      : `Quality ${q}${q === DEFAULT_QUALITY ? '' : ' (changed)'} · no size limit`;
  }

  // ---- choices ------------------------------------------------------------

  function changed(): void {
    outcome = null;
    button.classList.remove('is-done');
    scheduleRender();
  }

  function setFormat(next: ExportFormat, say = true): void {
    format = next;
    for (const option of $$<HTMLButtonElement>('#convertFormatGroup button')) {
      option.setAttribute('aria-checked', String(option.dataset.format === next));
    }
    // A row overridden to what is now the shared choice is no longer different.
    for (const [id, value] of overrides) if (value === next) overrides.delete(id);
    changed();
    kick();
    if (say) announce(`Convert to ${FORMATS[next].label}`);
  }

  for (const option of $$<HTMLButtonElement>('#convertFormatGroup button')) {
    option.addEventListener('click', () => {
      const next = option.dataset.format as ExportFormat | undefined;
      if (next && next in FORMATS && next !== format) setFormat(next);
    });
  }

  qualityInput.addEventListener('input', () => {
    quality = Number(qualityInput.value) / 100;
    qualityValue.textContent = qualityInput.value;
    changed();
    kickSoon();
  });

  budgetInput.addEventListener('input', () => {
    changed();
    kickSoon();
  });

  smallestButton.addEventListener('click', () => {
    const q = Number(smallestButton.dataset.quality);
    if (!q || converting) return;
    quality = q / 100;
    qualityInput.value = String(q);
    budgetInput.value = '';
    changed();
    kick();
    announce('Size limit removed. Review the result, then convert to download.');
  });

  button.addEventListener('click', async () => {
    const queue = items();
    if (!queue.length || converting) return;
    if (!validBudget()) { budgetInput.reportValidity(); return; }
    if (estimateTimer !== null) clearTimeout(estimateTimer);
    const options = { format, quality, targetBytes: budgetBytes(), template: DEFAULT_TEMPLATE, formatFor };
    const keys = queue.map(keyOf);
    converting = true;
    outcome = null;
    button.classList.remove('is-done');
    fill.style.opacity = '1';
    fill.style.width = '0%';
    render();
    announce(`Converting ${queue.length} image${queue.length === 1 ? '' : 's'}`);

    let ok = false;
    try {
      const result = await convertAndDownload(queue, options, (progress) => { fill.style.width = `${progress * 100}%`; });
      ok = result.delivery !== 'cancelled';
      const move = result.toBytes <= result.fromBytes ? 'down from' : 'up from';
      outcome = `${readableBytes(result.toBytes)}, ${move} ${readableBytes(result.fromBytes)}.`;
      if (ok) for (const key of keys) converted.add(key);
      const verb = result.delivery === 'shared' ? 'shared' : result.delivery === 'cancelled' ? 'cancelled' : 'downloaded';
      announce(`${result.count} file${result.count === 1 ? '' : 's'} ${verb}${result.delivery === 'cancelled' ? '' : ` as ${result.filename}`}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      outcome = `Convert failed: ${message}`;
      announce(outcome);
    }

    fill.style.opacity = '0';
    converting = false;
    if (ok) {
      button.classList.add('is-done');
      buttonLabel.textContent = 'Downloaded';
      setTimeout(() => {
        button.classList.remove('is-done');
        scheduleRender();
      }, 1_600);
    }
    render();
    kick();
  });

  subscribe((state) => {
    // Overrides belong to files; a file that left the list takes its own with it.
    for (const id of overrides.keys()) if (!state.items.some((item) => item.id === id)) overrides.delete(id);
    if (estimates.size > 4000) estimates.clear();
    scheduleRender();
    kick();
  });

  setFormat(format, false);

  return {
    setActive(next): void {
      active = next;
      if (next) { render(); kick(); }
    },
    setReading(count): void {
      reading = count;
      scheduleRender();
    },
    sync(): void {
      if (!active) return;
      render();
      kick();
    },
  };
}
