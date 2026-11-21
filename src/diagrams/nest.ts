/**
 * Nest: a system as nested windows (VM > pod > container > process, files), explored the way <Chronicle> is
 * (maximize, minimize, restore, the taskbar, details on click) but with no playback: no stages, log or motion.
 * Components/content/Nest.astro shows it as a static Chronicle (toChronicle below), with the plain window grid
 * (lintNest) as the fallback without JavaScript.
 *
 * Boxes use the Chronicle box shape (diagrams/chronicle.ts CBox: id, label, sub, kind, parent, icon, info, src),
 * plus a few fields for the fallback grid. Data pieces sit as chips on the box they belong to.
 */
import type { ArtKind, CBox, Chronicle } from './chronicle';
import { ICONS } from './icons';

export type NestTone = 'note' | 'good' | 'warn' | 'risk' | 'violet' | 'teal';

export interface NestBox extends Omit<CBox, 'initial' | 'weight'> {
  /** Kind tag override (default: the Chronicle tag for `kind`, e.g. "host", "qemu VM", "pod"). */
  tag?: string;
  /** A tinted frame, to tell parts apart (rack 1 vs rack 2). */
  tone?: NestTone;
  /** One short Markdown line shown under the sub line. */
  note?: string;
  /** Children per row (default: as many as fit, each at least 180 px wide). */
  cols?: number;
  /** Columns this box spans in its parent's grid. */
  span?: number;
}

export interface NestArt {
  id: string;
  label: string;
  kind: ArtKind;
  /** The box it sits on. */
  on: string;
  /** Details heading and tooltip (default: label). */
  title?: string;
  /** Markdown note in the details panel. */
  note?: string;
  /** The essential part, shown first (a few lines). */
  brief?: string;
  /** The full content (shown under "Full"). */
  body?: string;
  /** Link to the file it comes from (https). */
  src?: string;
  /** Highlighting language of brief / body (diagrams/chronicle.ts artLang: default from the kind). */
  lang?: string;
}

export interface Nest {
  title: string;
  root: string;
  boxes: NestBox[];
  arts?: NestArt[];
}

export const defineNest = (n: Nest) => n;

/**
 * The Nest as a static Chronicle: every box exists from the start, one stage places the data pieces, and the
 * viewer opens on that final state (<Chronicle static>). Window views are linted by lintChronicleWindows.
 */
export function toChronicle(n: Nest): Chronicle {
  return {
    title: n.title,
    root: n.root,
    boxes: n.boxes.map(({ tag: _t, tone: _o, note: _n, cols: _c, span: _s, ...b }) => ({ ...b, initial: true })),
    arts: (n.arts ?? []).map(({ on: _on, ...a }) => a),
    paths: [{
      id: 'now', title: n.title, kind: 'happy',
      stages: [{ id: 'now', title: n.title, phase: 'setup', about: n.title,
        events: [{ focus: n.root }, ...(n.arts ?? []).map((a) => ({ place: a.id, on: a.on }))] }],
    }],
  };
}

/** Build-time checks: ids resolve, one root, no cycles, known icons, https links. Returns errors. */
export function checkNest(n: Nest): string[] {
  const err: string[] = [];
  const boxes = new Map(n.boxes.map((b) => [b.id, b]));
  if (boxes.size !== n.boxes.length) err.push('duplicate box id');
  if (!boxes.has(n.root)) err.push(`root ${n.root} is not a box`);
  for (const b of n.boxes) {
    if (b.id !== n.root && !b.parent) err.push(`box ${b.id} has no parent`);
    if (b.parent && !boxes.has(b.parent)) err.push(`box ${b.id}: parent ${b.parent} is not a box`);
    if (b.icon && !(b.icon in ICONS)) err.push(`box ${b.id}: unknown icon ${b.icon}`);
    if (b.src !== undefined && !/^https:\/\/[^\s"<>]+$/.test(b.src)) err.push(`box ${b.id}: link must be an https URL`);
    const seen = new Set<string>();
    for (let cur: NestBox | undefined = b; cur && cur.id !== n.root; cur = cur.parent ? boxes.get(cur.parent) : undefined) {
      if (seen.has(cur.id)) { err.push(`box ${b.id}: parent cycle`); break; }
      seen.add(cur.id);
    }
  }
  const arts = new Set<string>();
  for (const a of n.arts ?? []) {
    if (arts.has(a.id)) err.push(`duplicate data piece id ${a.id}`);
    arts.add(a.id);
    if (!boxes.has(a.on)) err.push(`data piece ${a.id}: box ${a.on} is not a box`);
  }
  return err;
}

/**
 * Pixel model of nest.css, for the layout lint. Keep in step with the CSS: figure padding 6 and border 1,
 * window border 1.5, title bar padding 10 per side, grid padding and gap 6, auto columns at least 180 px,
 * title bar font 13 px, kind tag 10 px uppercase (+5 px padding, 1 px border), sub line 12 px mono,
 * chip 11.5 px mono with a 9 px kind tag.
 */
export const NEST_PX = { fig: 7, border: 1.5, headPad: 10, gridPad: 6, gap: 6, autoMin: 180, icon: 18, titleGap: 0.45 * 13,
  font: 13, tag: 10, sub: 12, chip: 11.5, chipTag: 9, leafMin: 140, maxDepth: 6, maxKids: 12 };

/** Width of a monospace string, px (JetBrains Mono advance: 0.6 em). */
const monoPx = (s: string, px: number) => [...s].length * 0.6 * px;
/** Width of a proportional string, px (diagrams/chronicle-model textEm, the same estimate the Chronicle lint uses). */
function sansPx(s: string, px: number) {
  let w = 0;
  for (const ch of s) {
    if ('iljtfr.,:;|!\'1 -()[]/'.includes(ch)) w += 0.32;
    else if ('mwMW@'.includes(ch)) w += 0.88;
    else if (ch >= 'A' && ch <= 'Z') w += 0.68;
    else w += 0.57;
  }
  return w * px;
}
/** Text of a one-line Markdown note without its markers (backticks, ** and link targets). */
const plain = (md: string) => md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '');

/**
 * Build check: at every width in `widths` (the figure's outer width, px), each window's title bar (icon, kind
 * tag, name) and sub line fit on one line, every chip fits its window, and no leaf window is narrower than
 * NEST_PX.leafMin. Structure: `cols` at most the number of children, `span` at most the parent's columns,
 * depth at most NEST_PX.maxDepth, at most NEST_PX.maxKids children per window. Narrow screens (one column,
 * nest.css media query) are not checked: there a long name may be cut with an ellipsis. Returns errors.
 */
export function lintNest(n: Nest, widths: number[] = [1060, 760], kindTag: Record<string, string> = {}): string[] {
  const P = NEST_PX;
  const err = new Set<string>();
  const kidsOf = new Map<string, NestBox[]>();
  for (const b of n.boxes) if (b.parent) kidsOf.set(b.parent, [...(kidsOf.get(b.parent) ?? []), b]);
  const arts = n.arts ?? [];
  for (const W of widths) {
    const walk = (b: NestBox, w: number, depth: number) => {
      const at = `box ${b.id} (${Math.round(w)} px wide at a ${W} px figure)`;
      const kids = kidsOf.get(b.id) ?? [];
      if (depth > P.maxDepth) err.add(`box ${b.id}: nested ${depth} deep, at most ${P.maxDepth}`);
      if (kids.length > P.maxKids) err.add(`box ${b.id}: ${kids.length} boxes inside, at most ${P.maxKids}; group them`);
      if (b.cols !== undefined && b.cols > Math.max(kids.length, 1)) err.add(`box ${b.id}: cols ${b.cols} but ${kids.length} boxes inside`);
      const inner = w - 2 * P.border - 2 * P.headPad;
      const tag = b.tag ?? kindTag[b.kind] ?? '';
      const tagPx = tag ? sansPx(tag.toUpperCase(), P.tag) + tag.length * 0.04 * P.tag + 12 : 0;
      const title = (b.icon ? P.icon + P.titleGap : 0) + (tag ? tagPx + P.titleGap : 0) + sansPx(b.label, P.font) * 1.04;
      if (title > inner) err.add(`${at}: title bar needs ${Math.round(title)} px, has ${Math.round(inner)}; shorten the name or tag, or give the box more room`);
      if (b.sub && monoPx(b.sub, P.sub) > inner) err.add(`${at}: sub line "${b.sub}" needs ${Math.round(monoPx(b.sub, P.sub))} px, has ${Math.round(inner)}`);
      if (b.note && sansPx(plain(b.note), P.sub) > inner * 2) err.add(`${at}: note is longer than two lines; move it to the page text`);
      for (const a of arts.filter((x) => x.on === b.id)) {
        const chip = 3 + 7 + 2 + sansPx(a.kind.toUpperCase(), P.chipTag) + 8 + 5 + monoPx(a.label, P.chip);
        if (chip > w - 2 * P.border - 16) err.add(`${at}: chip "${a.label}" needs ${Math.round(chip)} px`);
      }
      if (!kids.length) {
        if (w < P.leafMin) err.add(`${at}: a box narrower than ${P.leafMin} px is hard to read`);
        return;
      }
      const gridW = w - 2 * P.border - 2 * P.gridPad;
      const fit = Math.max(1, Math.floor((gridW + P.gap) / (P.autoMin + P.gap)));
      // auto-fit collapses empty tracks, so a few boxes share the whole width.
      const cols = b.cols ?? Math.min(fit, kids.length);
      const cell = (gridW - P.gap * (cols - 1)) / cols;
      for (const k of kids) {
        const span = k.span ?? 1;
        if (span > cols) err.add(`box ${k.id}: span ${span} but its parent ${b.id} has ${cols} column${cols > 1 ? 's' : ''} at a ${W} px figure`);
        walk(k, cell * Math.min(span, cols) + P.gap * (Math.min(span, cols) - 1), depth + 1);
      }
    };
    const root = n.boxes.find((b) => b.id === n.root);
    if (root) walk(root, W - 2 * P.fig, 1);
  }
  return [...err];
}
