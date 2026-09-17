// The size palette: one text box that always lands on the right size.
//
// With nothing typed it is a home rather than a list: the picture's own size
// and a custom one as two cards, six doors into the catalogue, the four shapes
// almost everything is, then the sizes this person pinned, saved and used.
// Typing turns it back into the search it always was.

import { search, ratioLabel, formatRows, browse } from './search.js';
import { CATEGORIES } from './presets.js';
import type { Category } from './presets.js';
import { loadSaved, addSaved, renameSaved, removeSaved } from './saved.js';
import { loadPinned, isPinned, togglePinned } from './pinned.js';
import { icon } from './icons.js';
import type { Dimensions, PinnedSize, SavedSize, SizeResult } from './domain/types.js';

const RECENTS_KEY = 'cropasap.recents';
// Written before the rename to CropASAP; read once so recents survive it.
const LEGACY_RECENTS_KEY = 'cropwizard.recents';
const MAX_RECENTS = 5;

/** A size waiting to be told what it is called, so it can go on the top bar. */
type NamingState = Dimensions;

export interface SizePickerOptions {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
  readonly list: HTMLElement;
  readonly trigger: HTMLButtonElement;
  readonly getTemplate?: () => Dimensions | null;
  /** The output size in force now; the custom form opens on it. */
  readonly getCurrent?: () => Dimensions | null;
  readonly onPick: (result: SizeResult) => void;
  /**
   * Runs before the list appears, whatever opened it. Asking for a size is
   * already a statement about the mode you are in, so a caller can settle that
   * here and keep it to the one click the user actually made.
   */
  readonly onBeforeOpen?: () => void;
  /** Fires whenever a row is pinned or unpinned, so the top bar can redraw. */
  readonly onPinsChange?: (pins: readonly PinnedSize[]) => void;
}

export interface SizePickerController {
  open(options?: SizePickerOpenOptions): void;
  close(): void;
  isOpen(): boolean;
}

/**
 * Per-opening placement for the size palette.
 *
 * The default remains the global modal. A caller may temporarily host the same
 * palette inside another surface, control focus restoration, omit an unfinished
 * image template, and restore its surrounding UI when the palette closes.
 */
export interface SizePickerOpenOptions {
  /** Temporarily render the palette inside another modal or surface. */
  readonly host?: HTMLElement;
  /** Control that receives focus when this particular opening closes. */
  readonly returnFocus?: HTMLElement;
  /** Omit image-derived choices while its preview is still being prepared. */
  readonly includeTemplate?: boolean;
  readonly onClose?: () => void;
}

const loadRecents = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY) ?? localStorage.getItem(LEGACY_RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const saveRecents = (ids: readonly string[]): void => {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(ids.slice(0, MAX_RECENTS)));
  } catch {
    // Recents are optional when storage is unavailable.
  }
};

function swatch(w: number, h: number): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'swatch';
  const long = 22;
  const [sw, sh] = w >= h
    ? [long, Math.max(5, (long * h) / w)]
    : [Math.max(5, (long * w) / h), long];
  el.style.width = `${sw}px`;
  el.style.height = `${sh}px`;
  return el;
}

function inscribe(iw: number, ih: number, ratio: number): Dimensions {
  return iw / ih > ratio
    ? { w: Math.round(ih * ratio), h: ih }
    : { w: iw, h: Math.round(iw / ratio) };
}

// Row actions are glyphs by tradition (☆ ✎ ✕), but a pin is a real icon, so
// the mark can be either a character or a drawn one.
// `pressed` is left out by the actions that simply do a thing, and given by the
// ones that are a state you are turning on and off.
function rowAction(
  label: string,
  mark: string | Node,
  onRun: () => void,
  pressed?: boolean,
): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = pressed ? 'row-action is-on' : 'row-action';
  el.title = label;
  el.setAttribute('aria-label', label);
  if (pressed !== undefined) el.setAttribute('aria-pressed', String(pressed));
  if (typeof mark === 'string') el.textContent = mark;
  else el.append(mark);
  el.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRun();
  });
  return el;
}

export function createSizePicker(options: SizePickerOptions): SizePickerController {
  const { root, input, list, trigger, getTemplate, getCurrent, onPick, onPinsChange, onBeforeOpen } = options;
  const title = root.querySelector<HTMLElement>('#pickerTitle');
  const lead = root.querySelector<HTMLElement>('#pickerLead');
  const searchBox = root.querySelector<HTMLElement>('#pickerSearch');
  const applyButton = root.querySelector<HTMLButtonElement>('#pickerApply');
  let rows: SizeResult[] = [];
  // Which door on the home is open, if any. Typing closes it.
  let category: Category | null = null;
  // The custom form: two numbers and whether the second follows the first.
  let custom: { w: number; h: number; locked: boolean } | null = null;
  let cursor = 0;
  let recents = loadRecents();
  let saved: SavedSize[] = loadSaved();
  let pins: PinnedSize[] = loadPinned();
  let template: Dimensions | null = null;
  let naming: NamingState | null = null;
  // The saved size whose name is being edited in place. A pencil beside the row
  // was a second target for a job the name itself can do: the text is what you
  // want to change, so the text is what you click.
  let renamingId: string | null = null;
  const home = root.parentNode;
  const homeNext = root.nextSibling;
  let returnFocus: HTMLElement = trigger;
  let afterClose: (() => void) | undefined;
  let embedded = false;

  function commitRename(value: string): void {
    if (!renamingId) return;
    saved = renameSaved(renamingId, value);
    renamingId = null;
    render();
  }

  function cancelRename(): void {
    if (!renamingId) return;
    renamingId = null;
    render();
  }

  /** Whatever is in the field right now, kept — without a re-render. */
  function keepPendingRename(): void {
    if (!renamingId) return;
    const field = list.querySelector<HTMLInputElement>('.picker-rename');
    if (field) saved = renameSaved(renamingId, field.value);
    renamingId = null;
  }

  function beginNaming(next: NamingState): void {
    naming = next;
    input.value = '';
    input.focus();
    render();
  }

  function commitNaming(): void {
    if (!naming) return;
    // Left blank, the pixels are the name. Asking again for something the row
    // already says out loud would be the app arguing with you.
    const name = input.value.trim() || `${naming.w} × ${naming.h}`;
    // A name given for the top bar is kept as a saved size too. Pins are keyed
    // by pixels, so unpinning would otherwise throw the name away and ask for
    // it again the next time.
    saved = addSaved(name, naming.w, naming.h);
    pins = togglePinned(name, naming.w, naming.h);
    onPinsChange?.(pins);
    naming = null;
    input.value = '';
    cursor = 0;
    render();
  }

  function cancelNaming(): void {
    naming = null;
    input.value = '';
    cursor = 0;
    render();
  }

  function renderNaming(): void {
    if (!naming) return;
    const note = document.createElement('p');
    note.className = 'picker-empty';
    note.textContent =
      `What should ${naming.w} × ${naming.h} be called on the top bar? Press Enter. Escape to cancel.`;
    list.append(note);
  }

  function ratioAnswer(result: SizeResult): SizeResult | null {
    if (!template) return null;
    const { w, h } = inscribe(template.w, template.h, result.w / result.h);
    return {
      kind: 'ratio',
      key: `ratio-${result.w}x${result.h}`,
      name: `${ratioLabel(result.w, result.h)} of this image`,
      detail: 'Its own pixels, cropped to shape',
      w,
      h,
    };
  }

  function appendRatioControl(container: HTMLElement, result: SizeResult): void {
    const answer = ratioAnswer(result);
    if (!answer) {
      const ratio = document.createElement('span');
      ratio.className = 'picker-ratio';
      ratio.textContent = ratioLabel(result.w, result.h);
      container.append(ratio);
      return;
    }

    const ratio = document.createElement('button');
    ratio.type = 'button';
    ratio.className = 'picker-ratio';
    ratio.textContent = ratioLabel(result.w, result.h);
    ratio.tabIndex = -1;
    const say = `Crop this image to ${ratioLabel(result.w, result.h)} — ${answer.w} × ${answer.h}, its own pixels`;
    ratio.title = say;
    ratio.setAttribute('aria-label', say);
    ratio.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      close();
      onPick(answer);
    });
    container.append(ratio);
  }

  // ---- the home ------------------------------------------------------------

  function card(name: string, detail: string, mark: Node, onRun: () => void): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'picker-card';
    const glyph = document.createElement('span');
    glyph.className = 'picker-card-mark';
    glyph.append(mark);
    const text = document.createElement('span');
    text.className = 'picker-card-text';
    const strong = document.createElement('strong');
    strong.textContent = name;
    const span = document.createElement('span');
    span.textContent = detail;
    text.append(strong, span);
    el.append(glyph, text);
    el.addEventListener('click', onRun);
    return el;
  }

  function heading(text: string): HTMLElement {
    const el = document.createElement('h3');
    el.className = 'picker-heading';
    el.textContent = text;
    return el;
  }

  function renderCards(): void {
    const cards = document.createElement('div');
    cards.className = 'picker-cards';
    if (template) {
      const { w, h } = template;
      cards.append(card('Match this image', `${w} × ${h}`, icon('image'), () => {
        close();
        onPick({ kind: 'template', key: 'template', name: 'Match this image', detail: 'Its own pixel size', w, h });
      }));
    }
    cards.append(card('Custom size', 'Set exact dimensions', icon('maximize'), openCustom));
    list.append(cards);
  }

  function renderChips(): void {
    list.append(heading('Browse presets'));
    const chips = document.createElement('div');
    chips.className = 'picker-chips';
    for (const entry of CATEGORIES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `picker-chip is-${entry.id}`;
      chip.setAttribute('aria-pressed', String(category?.id === entry.id));
      chip.append(icon(entry.icon), document.createTextNode(entry.label));
      chip.addEventListener('click', () => {
        category = category?.id === entry.id ? null : entry;
        cursor = 0;
        render();
        list.scrollTop = 0;
        // The arrows and Enter live on the search box, so the keyboard keeps
        // working after a click. Not on a phone: that would raise the keyboard.
        if (!matchMedia('(pointer: coarse)').matches) input.focus();
      });
      chips.append(chip);
    }
    list.append(chips);
  }

  function tile(result: SizeResult, index: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'picker-tile';
    el.id = `picker-row-${index}`;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', String(index === cursor));
    el.dataset.index = String(index);
    const shape = swatch(result.w, result.h);
    shape.classList.add('picker-tile-shape');
    // The home tile is a picture of the shape, twice the size of a row's.
    shape.style.width = `${parseFloat(shape.style.width) * 2.4}px`;
    shape.style.height = `${parseFloat(shape.style.height) * 2.4}px`;
    const text = document.createElement('span');
    text.className = 'picker-tile-text';
    const name = document.createElement('strong');
    name.textContent = result.name;
    const ratio = document.createElement('span');
    ratio.textContent = result.detail;
    const dims = document.createElement('span');
    dims.className = 'picker-tile-dims';
    dims.textContent = `${result.w} × ${result.h}`;
    text.append(name, ratio, dims);
    el.append(shape, text);
    const held = isPinned(pins, result.w, result.h);
    el.append(rowAction(
      held ? 'Unpin from the top bar' : 'Pin to the top bar',
      icon('pin'),
      () => {
        pins = togglePinned(result.name, result.w, result.h);
        onPinsChange?.(pins);
        render();
      },
      held,
    ));
    el.addEventListener('mousedown', (event) => {
      event.preventDefault();
      choose(index);
    });
    el.addEventListener('mousemove', () => setCursor(index));
    return el;
  }

  // ---- the custom form -----------------------------------------------------

  function openCustom(): void {
    const seed = getCurrent?.() ?? template ?? { w: 1080, h: 1080 };
    custom = { w: seed.w, h: seed.h, locked: false };
    category = null;
    render();
    list.querySelector<HTMLInputElement>('#customWidth')?.select();
  }

  function closeCustom(): void {
    custom = null;
    render();
    if (!matchMedia('(pointer: coarse)').matches) input.focus();
  }

  function applyCustom(): void {
    if (!custom) return;
    const { w, h } = custom;
    if (!(w > 0 && h > 0)) return;
    close();
    onPick({ kind: 'custom', key: `custom:${w}x${h}`, name: 'Custom size', detail: 'Exact pixels', w, h });
  }

  function renderCustom(): void {
    if (!custom) return;
    const form = document.createElement('form');
    form.className = 'picker-custom';
    form.addEventListener('submit', (event) => { event.preventDefault(); applyCustom(); });

    const field = (id: string, label: string, value: number): HTMLInputElement => {
      const wrap = document.createElement('label');
      wrap.className = 'picker-custom-field';
      const name = document.createElement('span');
      name.textContent = label;
      const box = document.createElement('input');
      box.id = id;
      box.type = 'number';
      box.inputMode = 'numeric';
      box.min = '1';
      box.max = '16384';
      box.step = '1';
      box.value = String(value);
      box.className = 'text-input';
      wrap.append(name, box);
      form.append(wrap);
      return box;
    };

    const width = field('customWidth', 'Width', custom.w);

    const lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'ghost picker-custom-lock';
    const paintLock = (): void => {
      if (!custom) return;
      lock.setAttribute('aria-pressed', String(custom.locked));
      lock.title = custom.locked ? 'Shape locked — unlock to set width and height separately' : 'Lock the shape so the other side follows';
      lock.setAttribute('aria-label', lock.title);
      lock.replaceChildren(icon(custom.locked ? 'link' : 'unlink'));
    };
    paintLock();
    lock.addEventListener('click', () => {
      if (!custom) return;
      custom.locked = !custom.locked;
      paintLock();
      readout();
    });
    form.append(lock);

    const height = field('customHeight', 'Height', custom.h);

    const note = document.createElement('p');
    note.className = 'picker-custom-note';
    form.append(note);
    const readout = (): void => {
      if (!custom) return;
      const ok = custom.w > 0 && custom.h > 0;
      note.textContent = ok
        ? `${custom.w} × ${custom.h} — ${ratioLabel(custom.w, custom.h)}. Press Enter to apply.`
        : 'Both sides need at least one pixel.';
      if (applyButton) applyButton.disabled = !ok;
    };

    const clamp = (raw: string): number => {
      const n = Math.round(Number(raw));
      return Number.isFinite(n) && n > 0 ? Math.min(n, 16384) : 0;
    };
    width.addEventListener('input', () => {
      if (!custom) return;
      const ratio = custom.w > 0 && custom.h > 0 ? custom.w / custom.h : 1;
      custom.w = clamp(width.value);
      if (custom.locked && custom.w > 0) {
        custom.h = Math.max(1, Math.round(custom.w / ratio));
        height.value = String(custom.h);
      }
      readout();
    });
    height.addEventListener('input', () => {
      if (!custom) return;
      const ratio = custom.w > 0 && custom.h > 0 ? custom.w / custom.h : 1;
      custom.h = clamp(height.value);
      if (custom.locked && custom.h > 0) {
        custom.w = Math.max(1, Math.round(custom.h * ratio));
        width.value = String(custom.w);
      }
      readout();
    });
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'account-link picker-custom-back';
    back.textContent = '← All sizes';
    back.addEventListener('click', closeCustom);
    form.append(back);

    readout();
    list.append(form);
  }

  // ---- drawing -------------------------------------------------------------

  function setHead(name: string, detail: string): void {
    if (title) title.textContent = name;
    if (lead) lead.textContent = detail;
  }

  function render(): void {
    list.textContent = '';
    if (applyButton) applyButton.disabled = false;
    if (searchBox) searchBox.hidden = Boolean(custom);
    root.classList.toggle('is-custom', Boolean(custom));
    if (naming) {
      setHead('Name this size', 'It goes on the top bar under that name.');
      renderNaming();
      return;
    }
    if (custom) {
      setHead('Custom size', 'Set exact dimensions.');
      renderCustom();
      return;
    }

    const typed = Boolean(input.value.trim());
    if (typed) category = null;
    setHead('Choose a size', category ? `${category.label} sizes, by platform.` : 'Search or start with a common format.');

    if (typed) {
      rows = search(input.value, recents, saved, template, pins);
    } else if (category) {
      renderChips();
      rows = browse(category);
    } else {
      renderCards();
      renderChips();
      rows = [...formatRows(), ...search('', recents, saved, template, pins)];
    }
    cursor = Math.min(cursor, Math.max(0, rows.length - 1));

    if (!rows.length) {
      const none = document.createElement('p');
      none.className = 'picker-empty';
      none.textContent = 'No size by that name. Type exact pixels instead — like 1200 x 630.';
      list.append(none);
      return;
    }

    // The common formats are a grid of tiles, not a run of rows, and they are
    // always the first entries — so the loop below starts after them.
    let first = 0;
    if (!typed && !category) {
      list.append(heading('Common formats'));
      const grid = document.createElement('div');
      grid.className = 'picker-formats';
      while (first < rows.length && rows[first]?.kind === 'format') {
        grid.append(tile(rows[first] as SizeResult, first));
        first += 1;
      }
      list.append(grid);
    }

    let section: string | null = null;
    rows.forEach((result, index) => {
      if (index < first) return;
      if (result.section && result.section !== section) {
        section = result.section;
        const head = document.createElement('div');
        head.className = 'picker-section';
        head.textContent = section;
        list.append(head);
      }

      const row = document.createElement('div');
      row.className = 'picker-row';
      row.id = `picker-row-${index}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(index === cursor));
      row.dataset.index = String(index);
      row.append(swatch(result.w, result.h));

      const text = document.createElement('span');
      text.className = 'picker-text';
      const detail = document.createElement('span');
      detail.textContent = result.detail;
      const savedId = result.kind === 'saved' ? result.savedId : undefined;

      if (savedId && savedId === renamingId) {
        // The name, become a field, exactly where the name was. Enter keeps it
        // and so does clicking away; Escape leaves it as it was.
        const field = document.createElement('input');
        field.type = 'text';
        field.className = 'picker-rename';
        field.value = result.name;
        field.setAttribute('aria-label', 'Size name');
        field.addEventListener('mousedown', (event) => event.stopPropagation());
        field.addEventListener('blur', () => commitRename(field.value));
        field.addEventListener('keydown', (event) => {
          // The list's own arrow and Enter handling belongs to the search box.
          event.stopPropagation();
          if (event.key === 'Enter') { event.preventDefault(); commitRename(field.value); }
          if (event.key === 'Escape') { event.preventDefault(); cancelRename(); }
        });
        text.append(field, detail);
      } else {
        const name = document.createElement('strong');
        name.textContent = result.name;
        if (savedId) {
          name.className = 'picker-name-edit';
          name.title = 'Click to rename';
          // Stopped and prevented: this click is about the name, and the row
          // beneath it would otherwise take it as "use this size" and close.
          name.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            renamingId = savedId;
            render();
          });
        }
        text.append(name, detail);
      }

      const dims = document.createElement('span');
      dims.className = 'picker-dims';
      dims.textContent = `${result.w} × ${result.h}`;

      row.append(text);
      appendRatioControl(row, result);
      row.append(dims);

      // Any size can be pinned, because the one you reach for every day is as
      // likely to be a preset or a raw pixel pair as something you saved.
      //
      // Some rows have a name and some only have a description of themselves —
      // "300 × 400", "Match this image". A chip on the top bar has to be called
      // something, so pinning one of those asks what, and that is the only thing
      // that ever asks. There used to be a separate star for saving a size,
      // which was a second act doing most of the same job and left people
      // wondering which one kept it.
      const held = isPinned(pins, result.w, result.h);
      const unnamed = result.kind === 'custom' || result.kind === 'template' || result.kind === 'whole';
      row.append(rowAction(
        held ? 'Unpin from the top bar' : 'Pin to the top bar',
        icon('pin'),
        () => {
          if (!held && unnamed) {
            beginNaming({ w: result.w, h: result.h });
            return;
          }
          pins = togglePinned(result.name, result.w, result.h);
          onPinsChange?.(pins);
          render();
        },
        held,
      ));

      if (savedId) {
        row.append(rowAction('Delete this size', '✕', () => {
          renamingId = null;
          saved = removeSaved(savedId);
          render();
        }));
      }

      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        choose(index);
      });
      row.addEventListener('mousemove', () => setCursor(index));
      list.append(row);
    });
    scrollToCursor();

    // Focused after the list exists, since that is when the field is in it.
    if (renamingId) {
      const field = list.querySelector<HTMLInputElement>('.picker-rename');
      field?.focus();
      field?.select();
    }
  }

  function setCursor(next: number): void {
    if (next === cursor) return;
    cursor = next;
    for (const row of list.querySelectorAll<HTMLElement>('.picker-row')) {
      row.setAttribute('aria-selected', String(Number(row.dataset.index) === cursor));
    }
    input.setAttribute('aria-activedescendant', `picker-row-${cursor}`);
  }

  function scrollToCursor(): void {
    list.querySelector<HTMLElement>(`#picker-row-${cursor}`)?.scrollIntoView({ block: 'nearest' });
  }

  function move(delta: number): void {
    if (!rows.length) return;
    setCursor((cursor + delta + rows.length) % rows.length);
    scrollToCursor();
  }

  function choose(index = cursor, shape = false): void {
    // A row's mousedown prevents the default, so focus never leaves the rename
    // field and its blur never fires. The edit is kept here instead of being
    // lost to the click that moved on.
    keepPendingRename();
    const row = rows[index];
    if (!row) return;
    const result = shape ? ratioAnswer(row) ?? row : row;
    if (result.id) {
      recents = [result.id, ...recents.filter((id) => id !== result.id)].slice(0, MAX_RECENTS);
      saveRecents(recents);
    }
    close();
    onPick(result);
  }

  function open(openOptions: SizePickerOpenOptions = {}): void {
    onBeforeOpen?.();
    returnFocus = openOptions.returnFocus ?? trigger;
    afterClose = openOptions.onClose;
    if (openOptions.host) {
      openOptions.host.append(root);
      root.removeAttribute('role');
      root.removeAttribute('aria-modal');
      embedded = true;
    }
    root.hidden = false;
    naming = null;
    custom = null;
    category = null;
    // Opened on the home, not on whatever was typed last time.
    input.value = '';
    saved = loadSaved();
    pins = loadPinned();
    template = openOptions.includeTemplate === false ? null : getTemplate?.() ?? null;
    const shapeHint = root.querySelector<HTMLElement>('#shapeHint');
    if (shapeHint) shapeHint.hidden = !template;
    // On a touch screen, focusing the field throws up the keyboard and takes
    // half the list with it — before anyone has had a chance to look at what is
    // on offer. Typing is one tap away; seeing the list should not be.
    if (!matchMedia('(pointer: coarse)').matches) {
      input.select();
      input.focus();
    }
    cursor = 0;
    render();
    requestAnimationFrame(() => root.classList.add('open'));
  }

  function close(): void {
    keepPendingRename();
    naming = null;
    custom = null;
    category = null;
    root.classList.remove('open');
    root.hidden = true;
    if (embedded && home) {
      home.insertBefore(root, homeNext);
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      embedded = false;
    }
    const focusTarget = returnFocus;
    const callback = afterClose;
    returnFocus = trigger;
    afterClose = undefined;
    callback?.();
    focusTarget.focus();
  }

  input.addEventListener('input', () => {
    if (!naming) {
      cursor = 0;
      render();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (naming) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitNaming();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelNaming();
      }
      return;
    }

    const keys: Readonly<Record<string, () => void>> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Enter: () => choose(cursor, event.shiftKey),
      // Inside a door, Escape steps back out to the home first.
      Escape: () => { if (category) { category = null; cursor = 0; render(); } else close(); },
      Tab: close,
    };
    const action = keys[event.key];
    if (!action) return;
    if (event.key !== 'Tab') event.preventDefault();
    action();
  });

  root.addEventListener('mousedown', (event) => {
    if (event.target === root) close();
  });
  // Escape from anywhere in the panel — a chip, a card, the custom form —
  // backs out one step: the form or the door first, then the dialog. The
  // search box has its own handler for the same key.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.target === input) return;
    event.preventDefault();
    if (custom) closeCustom();
    else if (category) { category = null; cursor = 0; render(); input.focus(); }
    else close();
  });
  root.querySelector<HTMLButtonElement>('#pickerClose')?.addEventListener('click', () => close());
  root.querySelector<HTMLButtonElement>('#pickerCancel')?.addEventListener('click', () => close());
  applyButton?.addEventListener('click', () => {
    if (custom) applyCustom();
    else if (naming) commitNaming();
    else choose(cursor);
  });
  trigger.addEventListener('click', () => open());

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (root.hidden) open();
      else close();
    }
  });

  return { open, close, isOpen: () => !root.hidden };
}
