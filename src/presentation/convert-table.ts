// The Convert room's stage: every file in, and what it becomes.
//
// A crop is a decision about one picture, so its stage is the picture. A
// conversion is a decision about files, so its stage is the files — one row
// each, the same view for one or three hundred. The table only draws; what a
// row says is decided by the panel that owns the choices, so there is exactly
// one place where "what will this file become?" is answered.

import { FORMATS } from '../export.js';
import { canvasContext } from '../infrastructure/dom.js';
import type { CropItem, ExportFormat } from '../domain/types.js';

const THUMB = 44;

export type RowTone = 'neutral' | 'better' | 'worse';

/** One row, already worded. The table compares these and touches only what moved. */
export interface ConvertRowView {
  readonly item: CropItem;
  readonly now: string;
  readonly becomes: string;
  readonly change: string;
  readonly tone: RowTone;
  readonly status: string;
  readonly statusTone: RowTone;
  /** DEC-11's loss tags. Empty until those readers land. */
  readonly losses: readonly string[];
  readonly format: ExportFormat;
  readonly overridden: boolean;
  readonly detail: string;
}

export interface ConvertTableView {
  readonly rows: readonly ConvertRowView[];
  readonly summary: string;
  /** Files still being read in, so the room says it is busy rather than short. */
  readonly reading: number;
  readonly busy: boolean;
}

export interface ConvertTableOptions {
  readonly root: HTMLElement;
  readonly onChoose: () => void;
  readonly onRemove: (id: string) => void;
  readonly onClear: () => void;
  readonly onOverride: (id: string, format: ExportFormat | null) => void;
  /** Rows scrolling into view: the estimator measures what is being looked at first. */
  readonly onVisible: () => void;
}

export interface ConvertTableController {
  render(view: ConvertTableView): void;
  visibleIds(): ReadonlySet<string>;
}

interface RowParts {
  readonly el: HTMLLIElement;
  readonly toggle: HTMLButtonElement;
  readonly thumb: HTMLCanvasElement;
  readonly name: HTMLElement;
  readonly now: HTMLElement;
  readonly becomes: HTMLElement;
  readonly change: HTMLElement;
  readonly status: HTMLElement;
  readonly losses: HTMLElement;
  readonly detail: HTMLElement;
  readonly detailText: HTMLElement;
  readonly choices: HTMLButtonElement[];
  drawn: boolean;
  last: ConvertRowView | null;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const setText = (node: HTMLElement, text: string): void => {
  if (node.textContent !== text) node.textContent = text;
};

const OVERRIDES: readonly (ExportFormat | null)[] = [null, 'webp', 'png', 'jpeg'];

export function createConvertTable(options: ConvertTableOptions): ConvertTableController {
  const { root, onChoose, onRemove, onClear, onOverride, onVisible } = options;
  const rows = new Map<string, RowParts>();
  const visible = new Set<string>();
  const expanded = new Set<string>();

  // An empty room is a place to drop, and it says what it takes. Nothing about
  // it needs a picture to be loaded first.
  const empty = el('div', 'ct-empty');
  const emptyMark = el('span', 'icon ct-empty-mark');
  emptyMark.dataset.icon = 'swap';
  const emptyTitle = el('h1', '', 'Drop images to convert');
  const emptyText = el('p', '', 'PNG, JPEG, WebP, GIF, BMP — anything this browser can open. One file or a whole folder’s worth.');
  const emptyButton = el('button', 'primary', 'Choose images');
  emptyButton.type = 'button';
  emptyButton.addEventListener('click', onChoose);
  const emptyPrivacy = el('p', 'ct-empty-privacy', 'Files are converted on this device and never uploaded.');
  empty.append(emptyMark, emptyTitle, emptyText, emptyButton, emptyPrivacy);

  const head = el('div', 'ct-head');
  const summary = el('p', 'ct-summary');
  summary.setAttribute('role', 'status');
  const add = el('button', 'secondary ct-add', 'Add images');
  add.type = 'button';
  add.addEventListener('click', onChoose);
  const clear = el('button', 'ghost ct-clear', 'Clear');
  clear.type = 'button';
  clear.addEventListener('click', onClear);
  head.append(summary, add, clear);

  const columns = el('div', 'ct-columns');
  columns.setAttribute('aria-hidden', 'true');
  for (const label of ['', 'File', 'Now', 'Becomes', 'Change', 'Status']) columns.append(el('span', '', label));

  const list = el('ol', 'ct-list');
  list.setAttribute('aria-label', 'Files to convert');
  root.append(empty, head, columns, list);

  // Visibility drives two cheap things: drawing a thumbnail only once a row is
  // on screen, and telling the estimator which files someone is looking at.
  const observer = new IntersectionObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset.id;
      if (!id) continue;
      if (entry.isIntersecting) {
        if (!visible.has(id)) { visible.add(id); changed = true; }
        const parts = rows.get(id);
        if (parts && !parts.drawn && parts.last) drawThumb(parts, parts.last.item);
      } else if (visible.delete(id)) changed = true;
    }
    if (changed) onVisible();
  }, { root, rootMargin: '200px 0px' });

  function drawThumb(parts: RowParts, item: CropItem): void {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = Math.round(THUMB * dpr);
    parts.thumb.width = size;
    parts.thumb.height = size;
    const ctx = canvasContext(parts.thumb);
    const { naturalWidth: w, naturalHeight: h } = item.image;
    if (!w || !h) return;
    // The whole picture, letterboxed: this is the file, not a crop of it.
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(item.image, (size - dw) / 2, (size - dh) / 2, dw, dh);
    parts.drawn = true;
  }

  function build(item: CropItem): RowParts {
    const li = el('li', 'ct-row');
    li.dataset.id = item.id;
    const toggle = el('button', 'ct-main');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    const thumb = el('canvas', 'ct-thumb');
    thumb.setAttribute('aria-hidden', 'true');
    const nameCell = el('span', 'ct-name-cell');
    const name = el('span', 'ct-name');
    const losses = el('span', 'ct-losses');
    nameCell.append(name, losses);
    const now = el('span', 'ct-now');
    const becomes = el('span', 'ct-becomes');
    const change = el('span', 'ct-change');
    const status = el('span', 'ct-status');
    toggle.append(thumb, nameCell, now, becomes, change, status);

    const detail = el('div', 'ct-detail');
    detail.hidden = true;
    const detailText = el('p', 'ct-detail-text');
    const pickLabel = el('span', 'ct-detail-label', 'This file as');
    const group = el('div', 'segmented ct-override');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', `Format for ${item.file.name}`);
    const choices = OVERRIDES.map((format) => {
      const choice = el('button', '', format ? FORMATS[format].label : 'Same as all');
      choice.type = 'button';
      choice.setAttribute('role', 'radio');
      choice.dataset.format = format ?? '';
      choice.addEventListener('click', () => onOverride(item.id, format));
      return choice;
    });
    group.append(...choices);
    const remove = el('button', 'ghost ct-remove', 'Remove from list');
    remove.type = 'button';
    remove.addEventListener('click', () => onRemove(item.id));
    const pick = el('div', 'ct-detail-pick');
    pick.append(pickLabel, group);
    detail.append(detailText, pick, remove);

    toggle.addEventListener('click', () => {
      const open = !expanded.has(item.id);
      if (open) expanded.add(item.id); else expanded.delete(item.id);
      toggle.setAttribute('aria-expanded', String(open));
      detail.hidden = !open;
      li.classList.toggle('is-open', open);
    });

    li.append(toggle, detail);
    const parts: RowParts = {
      el: li, toggle, thumb, name, now, becomes, change, status, losses, detail, detailText, choices,
      drawn: false, last: null,
    };
    observer.observe(li);
    return parts;
  }

  function update(parts: RowParts, row: ConvertRowView): void {
    const last = parts.last;
    parts.last = row;
    if (last?.item.image !== row.item.image) parts.drawn = false;
    if (!parts.drawn && visible.has(row.item.id)) drawThumb(parts, row.item);
    if (last && last.now === row.now && last.becomes === row.becomes && last.change === row.change
      && last.status === row.status && last.tone === row.tone && last.statusTone === row.statusTone
      && last.detail === row.detail && last.format === row.format && last.overridden === row.overridden
      && last.losses.join() === row.losses.join() && last.item.file === row.item.file) return;

    setText(parts.name, row.item.file.name);
    parts.name.title = row.item.file.name;
    setText(parts.now, row.now);
    setText(parts.becomes, row.becomes);
    setText(parts.change, row.change);
    parts.change.dataset.tone = row.tone;
    setText(parts.status, row.status);
    parts.status.dataset.tone = row.statusTone;
    parts.becomes.classList.toggle('is-override', row.overridden);
    parts.losses.replaceChildren(...row.losses.map((loss) => el('span', 'ct-loss', loss)));
    parts.losses.hidden = row.losses.length === 0;
    setText(parts.detailText, row.detail);
    parts.toggle.setAttribute('aria-label',
      `${row.item.file.name}. Now ${row.now}. Becomes ${row.becomes}. ${row.change}. ${row.status}. Show details`);
    for (const choice of parts.choices) {
      const value = choice.dataset.format || null;
      choice.setAttribute('aria-checked', String(row.overridden ? value === row.format : value === null));
    }
  }

  function render(view: ConvertTableView): void {
    const hasRows = view.rows.length > 0;
    empty.hidden = hasRows || view.reading > 0;
    head.hidden = !hasRows && view.reading === 0;
    columns.hidden = !hasRows;
    setText(summary, view.summary);
    add.disabled = view.busy;
    clear.disabled = view.busy || !hasRows;

    const ids = new Set(view.rows.map((row) => row.item.id));
    for (const [id, parts] of rows) {
      if (ids.has(id)) continue;
      observer.unobserve(parts.el);
      parts.el.remove();
      rows.delete(id);
      visible.delete(id);
      expanded.delete(id);
    }

    // Rows are appended in queue order; an existing row is left where it is
    // unless the order itself changed, so a re-render moves nothing.
    let previous: HTMLLIElement | null = null;
    for (const row of view.rows) {
      let parts = rows.get(row.item.id);
      if (!parts) {
        parts = build(row.item);
        rows.set(row.item.id, parts);
      }
      const expected: Element | null = previous ? previous.nextElementSibling : list.firstElementChild;
      if (expected !== parts.el) list.insertBefore(parts.el, expected);
      update(parts, row);
      for (const choice of parts.choices) choice.disabled = view.busy;
      previous = parts.el;
    }
  }

  return { render, visibleIds: () => visible };
}
