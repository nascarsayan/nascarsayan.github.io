/**
 * The pure part of <Chronicle>: paths flattened into events and steps, the state after any number of events,
 * tile sizes and tile placement. The browser (scripts/chronicle.ts) draws from it, and the build checks
 * (lintChronicleLayout, called by components/content/Chronicle.astro) replay it, so both see the same layout.
 */
import type { CEv, Chronicle, CStage, Status, Tone } from './chronicle';

export interface Flat { ev: CEv; stage: number; pos: number }
export interface Step { start: number; end: number; change: number; hasLog: boolean }
export interface Call { text: string; at: string; tone: Tone; ref?: string; pos: number }
export interface Line { text: string; pos: number; stage: number; head?: boolean; gen?: boolean }
export interface State {
  alive: Set<string>;
  status: Map<string, Status>;
  badge: Map<string, string>;
  arts: Map<string, string[]>;
  calls: Call[];
  focus: string;
  lines: Line[];
}
export interface Index { c: Chronicle; boxes: Map<string, Chronicle['boxes'][number]>; kids: Map<string, string[]> }

export function index(c: Chronicle): Index {
  const boxes = new Map(c.boxes.map((b) => [b.id, b]));
  const kids = new Map<string, string[]>();
  for (const b of c.boxes) if (b.parent) kids.set(b.parent, [...(kids.get(b.parent) ?? []), b.id]);
  return { c, boxes, kids };
}

/** A path as one event list: a failure path is the happy path's stages before `forkAt`, then its own. */
export function flatten(c: Chronicle, pathId: string) {
  const p = c.paths.find((x) => x.id === pathId) ?? c.paths[0];
  const happy = c.paths[0];
  let stages: CStage[] = p.stages;
  let prefix = 0;
  if (p.kind === 'failure') {
    prefix = happy.stages.findIndex((s) => s.id === p.forkAt);
    stages = [...happy.stages.slice(0, prefix), ...p.stages];
  }
  const flat: Flat[] = [];
  const starts: number[] = [];
  stages.forEach((s, i) => {
    starts.push(flat.length);
    for (const ev of s.events) flat.push({ ev, stage: i, pos: flat.length });
  });
  starts.push(flat.length);
  // Steps: each picture-changing event with the log lines around it (before it, up to the next change).
  const isChange = (e: CEv) => !('log' in e) && !('wait' in e);
  const steps: Step[] = [];
  stages.forEach((_, si) => {
    let start = starts[si];
    let change = -1;
    const close = (end: number) => {
      if (end <= start) return;
      steps.push({ start, end, change, hasLog: flat.slice(start, end).some((f) => 'log' in f.ev) });
    };
    for (let i = starts[si]; i < starts[si + 1]; i++) {
      if (!isChange(flat[i].ev)) continue;
      // A callout marker belongs to the change before it in the stage: no step of its own.
      if ('call' in flat[i].ev && change >= 0) continue;
      if (change >= 0) { close(i); start = i; }
      change = i;
    }
    close(starts[si + 1]);
  });
  return { path: p, stages, prefix, flat, starts, steps };
}

export function fresh(ix: Index): State {
  const alive = new Set(ix.c.boxes.filter((b) => b.initial || b.id === ix.c.root).map((b) => b.id));
  return { alive, status: new Map(), badge: new Map(), arts: new Map(), calls: [], focus: ix.c.root, lines: [] };
}

export function descendants(ix: Index, id: string): string[] {
  const out: string[] = [];
  const walk = (x: string) => { for (const k of ix.kids.get(x) ?? []) { out.push(k); walk(k); } };
  walk(id);
  return out;
}

export const aliveKids = (ix: Index, st: State, id: string) => (ix.kids.get(id) ?? []).filter((k) => st.alive.has(k));

const addArt = (st: State, box: string, art: string) => {
  const v = st.arts.get(box) ?? [];
  if (!v.includes(art)) st.arts.set(box, [...v, art]);
};

export function apply(ix: Index, st: State, f: Flat) {
  const e = f.ev;
  const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
  if ('focus' in e) st.focus = e.focus;
  else if ('spawn' in e) for (const b of list(e.spawn)) {
    // A box appears inside its parent: make the parent chain alive too.
    for (let x: string | undefined = b; x; x = ix.boxes.get(x)?.parent) st.alive.add(x);
    if (e.status) st.status.set(b, e.status);
  }
  else if ('kill' in e) for (const b of list(e.kill)) {
    for (const x of [b, ...descendants(ix, b)]) { st.alive.delete(x); st.arts.delete(x); st.status.delete(x); st.badge.delete(x); }
    while (!st.alive.has(st.focus)) st.focus = ix.boxes.get(st.focus)?.parent ?? ix.c.root;
  }
  else if ('send' in e) { if (e.keep !== false) addArt(st, e.to, e.send); }
  else if ('place' in e) addArt(st, e.on, e.place);
  else if ('drop' in e) for (const [k, v] of st.arts) st.arts.set(k, v.filter((a) => a !== e.drop));
  else if ('status' in e) for (const b of list(e.status)) { st.status.set(b, e.is); if (e.badge !== undefined) st.badge.set(b, e.badge); }
  else if ('call' in e) st.calls.push({ text: e.call, at: e.at, tone: e.tone ?? 'note', ref: e.ref, pos: f.pos });
  else if ('log' in e) for (const t of list(e.log)) st.lines.push({ text: t, pos: f.pos, stage: f.stage });
}

/**
 * Tile sizes: the box that matters most right now gets 2×2, the next ones 2×1, the rest 1×1. Weight: boxes
 * this stage has touched so far inside it (the most), what runs inside it, its data pieces, the spec weight.
 */
export function tileSpans(ix: Index, st: State, F: string, kids: string[], flat: Flat[], from: number, pos: number): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  if (kids.length < 3) return out;
  const under = (id: string): string | undefined => { for (let x: string | undefined = id; x; x = ix.boxes.get(x)?.parent) if (ix.boxes.get(x)?.parent === F) return x; return undefined; };
  const touched = new Map<string, number>();
  for (let i = from; i < pos; i++) {
    const e = flat[i].ev as Record<string, unknown>;
    for (const key of ['focus', 'spawn', 'status', 'from', 'to', 'on', 'at']) {
      for (const id of ([] as unknown[]).concat(e[key] ?? []) as string[]) { const k = under(id); if (k) touched.set(k, (touched.get(k) ?? 0) + 1); }
    }
  }
  const score = (k: string) => 4 * (touched.get(k) ?? 0) + 2 * descendants(ix, k).filter((x) => st.alive.has(x)).length
    + (st.arts.get(k)?.length ?? 0) + (ix.boxes.get(k)?.weight ?? 0);
  const ranked = kids.map((k, i) => ({ k, i, s: score(k) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
  if (ranked[0]) out.set(ranked[0].k, kids.length >= 5 ? [2, 2] : [2, 1]);
  for (const r of ranked.slice(1, kids.length >= 7 ? 3 : 2)) if (r.s >= ranked[0].s / 2) out.set(r.k, [2, 1]);
  return out;
}

/**
 * Tile geometry: minimum size, gap, the target shape (golden ratio), the allowed range of width : height, and
 * the content scale range (minScale lets a crowded tile shrink below its base size instead of overflowing).
 */
export const TILE = { minWidth: 200, minHeight: 96, gap: 0, target: 1.618, minRatio: 0.7, maxRatio: 2.8, minUsage: 0.22, minScale: 0.8, maxScale: 2, subMinPx: 9 };

/** The kind tag in a box's title bar (empty: none). */
export const KIND_TAG: Record<string, string> = { world: '', site: 'cluster', machine: 'host', vm: 'qemu VM', container: 'container', process: 'proc', store: 'files', k8s: 'k8s', pod: 'pod', external: 'internet' };

/** Width of `text` in em of its font (a proportional UI font, bold): narrow, wide and capital letters apart. */
export function textEm(text: string) {
  let w = 0;
  for (const ch of text) {
    if ('iljtfr.,:;|!\'1 -()[]/'.includes(ch)) w += 0.32;
    else if ('mwMW@'.includes(ch)) w += 0.88;
    else if (ch >= 'A' && ch <= 'Z') w += 0.68;
    else w += 0.57;
  }
  return w;
}

/** Window buttons in a tile's title bar, px (fixed size; CSS .ch-box .ch-tb). */
export const TOOL = { w: 24, gap: 3 };
/** Fixed parts of a tile, px: side padding plus its 3 px edge (CSS .ch-box, --ch-edge), title bar padding (CSS .ch-box > .ch-head). */
export const CHROME = { padX: 27, headPadY: 13 };

/**
 * Width the title bar of tile `id` needs at content scale k, px: icon, kind tag, status dot, name, badge and
 * the window buttons (minimize, plus maximize when it has boxes inside), with the gaps between them.
 */
export function titleWidth(ix: Index, st: State, id: string, k: number) {
  const b = ix.boxes.get(id);
  if (!b) return 0;
  const f = 13 * k;
  const tag = KIND_TAG[b.kind] ?? '';
  const badge = st.badge.get(id);
  const parts = [
    b.icon ? 1.45 * f : 0,
    tag ? (textEm(tag.toUpperCase()) + 0.04 * tag.length) * 0.62 * f * 0.8 + 12 : 0,
    0.7 * f,
    // Bold text runs wider than the regular-weight table; 10% margin.
    textEm(b.label) * 1.23 * f * 1.1,
    badge ? textEm(badge) * 11 * 0.85 + 12 : 0,
  ].filter((x) => x > 0);
  const tools = 1 + (aliveKids(ix, st, id).length ? 1 : 0);
  return parts.reduce((a, x) => a + x, 0) + parts.length * 0.45 * f + tools * (TOOL.w + TOOL.gap) + 4;
}

/** Boxes with nothing in them (no boxes, no data pieces) leave the grid for the strip under it, when others remain. */
export function splitIdle(ix: Index, st: State, kids: string[]) {
  const busy = (k: string) => aliveKids(ix, st, k).length > 0 || (st.arts.get(k)?.length ?? 0) > 0;
  const active = kids.filter(busy);
  if (!active.length) return { active: kids, idle: [] as string[] };
  return { active, idle: kids.filter((k) => !busy(k)) };
}

/**
 * The strip of idle boxes: 40 px cells under the grid's 3 px edge (--ch-edge; CSS .ch-strip). Its cells take
 * the spans of the bottom row of tiles, so every cell edge continues a tile edge above (a span is split into
 * whole columns only while the strip would need more rows than plain columns); boxes wrap onto more rows, and
 * in a short last row the last box stretches to the end. Positions are in grid units, like tiles.
 */
export function stripCells(tiles: Placed[], rows: number, n: number): Placed[] {
  const segs: [number, number][] = tiles.filter((t) => t.row + t.h === rows).map((t) => [t.col, t.w] as [number, number]).sort((a, b) => a[0] - b[0]);
  if (!n || !segs.length) return [];
  // No more rows than plain logical columns would need: split the widest span on a column boundary until so.
  const cols = Math.max(1, Math.round(segs.reduce((a, s) => a + s[1], 0) / UNITS));
  const most = Math.ceil(n / Math.min(n, cols));
  while (Math.ceil(n / segs.length) > most) {
    const i = segs.reduce((b, s, k) => (s[1] > segs[b][1] ? k : b), 0);
    const [c, w] = segs[i];
    if (w < 2 * UNITS) break;
    const left = Math.floor(w / UNITS / 2) * UNITS;
    segs.splice(i, 1, [c, left], [c + left, w - left]);
  }
  const out: Placed[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / segs.length), s = i % segs.length;
    const last = i === n - 1;
    const end = last ? segs[segs.length - 1][0] + segs[segs.length - 1][1] : segs[s][0] + segs[s][1];
    out.push({ id: String(i), col: segs[s][0], row, w: end - segs[s][0], h: 1 });
  }
  return out;
}
export const STRIP = { cell: 40, edge: 3 };
// Each cell is 40 px including its 3 px bottom wall (the last row's falls under the frame), plus the strip's
// 3 px top wall.
export const stripHeight = (cells: Placed[]) => (cells.length ? (Math.max(...cells.map((c) => c.row)) + 1) * STRIP.cell + STRIP.edge : 0);

/**
 * How much of a tile its content needs at the smallest sizes (head, sub line, data chips and child cards,
 * wrapping at the tile's width), as a share of the tile's height. The content then grows to fill the tile;
 * a low share means a big tile for little (the build check wants at least TILE.minUsage).
 */
/** Height the content of tile `id` needs at content scale k in a tile `w` px wide (head, sub, chips, cards). */
function contentNeed(ix: Index, st: State, id: string, w: number, k: number) {
  const inner = w - CHROME.padX;
  const per = (min: number) => Math.max(1, Math.floor((inner + 6) / (min * k + 6)));
  const chips = st.arts.get(id)?.length ?? 0;
  const cards = aliveKids(ix, st, id).length;
  // Title bar (one line), sub line, chip rows (2.1em at 12.5px + gap) and card rows (2.8em at 13px + gap),
  // with the 6 px gaps between the sections and the bottom padding.
  const sections = 1 + (ix.boxes.get(id)?.sub ? 1 : 0) + (chips ? 1 : 0) + (cards ? 1 : 0);
  return CHROME.headPadY + Math.max(22, 13 * 1.23 * 1.5 * k) + (ix.boxes.get(id)?.sub ? 13 * 0.92 * 1.5 * k : 0)
    + Math.ceil(chips / per(150)) * (26 * k + 5) + Math.ceil(cards / per(9.5 * 13)) * (36.5 * k + 6) + sections * 6 + 8;
}

/** Width of tile `id`'s sub line (monospace, 0.6 em a character) at font size `px`. */
export function subWidth(ix: Index, id: string, px: number) {
  return (ix.boxes.get(id)?.sub?.length ?? 0) * 0.6 * px;
}

/** Whether tile `id`'s sub line fits a tile `w` px wide at its smallest font (the browser shrinks it to fit). */
export function subFits(ix: Index, id: string, w: number) {
  return subWidth(ix, id, TILE.subMinPx) <= w - CHROME.padX;
}

/** Whether tile `id`'s title bar fits on one line at scale k in a tile `w` px wide. */
export function titleFits(ix: Index, st: State, id: string, w: number, k: number) {
  return titleWidth(ix, st, id, k) <= w - CHROME.padX + 4;
}

/**
 * Content scale of a tile w × h px: its shorter side over 160 px, at least 1, at most TILE.maxScale, and never
 * more than its content can take without overflowing (the browser sets it as --k on the tile).
 */
export function contentScale(ix: Index, st: State, id: string, w: number, h: number) {
  let k = Math.max(1, Math.min(TILE.maxScale, Math.min(w, h) / 160));
  const tight = (x: number) => contentNeed(ix, st, id, w, x) > 0.95 * h || !titleFits(ix, st, id, w, x);
  while (k > TILE.minScale && tight(k)) k = Math.max(TILE.minScale, k - 0.05);
  return Math.round(k * 100) / 100;
}

/** Whether tile `id` overflows (content taller than the tile, or a title bar too wide) even at TILE.minScale. */
export function overflows(ix: Index, st: State, id: string, w: number, h: number) {
  return { y: contentNeed(ix, st, id, w, TILE.minScale) > h, x: !titleFits(ix, st, id, w, TILE.minScale) || !subFits(ix, id, w) };
}

/** Share of the tile's height its content uses at its content scale (the build check wants TILE.minUsage). */
export function contentUsage(ix: Index, st: State, id: string, w: number, h: number) {
  return Math.min(1, contentNeed(ix, st, id, w, contentScale(ix, st, id, w, h)) / h);
}

export interface Placed { id: string; col: number; row: number; w: number; h: number }

/** Grid units per logical column: a short row can share its free space evenly (6 splits by 1, 2, 3 and 6). */
export const UNITS = 6;

/**
 * Place tiles on a grid of `cols` logical columns (UNITS units each). Tiles go in order to the first free spot
 * (dense, row by row). Then each row is justified: the 1-row tiles of the row share its free units evenly,
 * between the cells held by taller tiles. A gap no 1-row tile can take lengthens the tile above it. Returned
 * positions and widths are in units (0-based); `fill` is the share of covered units.
 */
export function placeTiles(items: { id: string; w: number; h: number }[], cols: number): { tiles: Placed[]; rows: number; fill: number } {
  const W = cols * UNITS;
  const tiles: Placed[] = [];
  const occ = (r: number, c: number, skip?: Placed) => tiles.some((t) => t !== skip && r >= t.row && r < t.row + t.h && c >= t.col && c < t.col + t.w);
  for (const it of items) {
    const w = Math.min(it.w, cols) * UNITS;
    for (let r = 0, done = false; !done; r++) {
      for (let c = 0; c + w <= W && !done; c += UNITS) {
        let free = true;
        for (let dr = 0; dr < it.h && free; dr++) for (let dc = 0; dc < w && free; dc++) if (occ(r + dr, c + dc)) free = false;
        if (free) { tiles.push({ id: it.id, col: c, row: r, w, h: it.h }); done = true; }
      }
    }
  }
  const rows = tiles.reduce((n, t) => Math.max(n, t.row + t.h), 0);
  for (let r = 0; r < rows; r++) {
    const movable = tiles.filter((t) => t.row === r && t.h === 1).sort((a, b) => a.col - b.col);
    const blocked = (c: number) => tiles.some((t) => !movable.includes(t) && r >= t.row && r < t.row + t.h && c >= t.col && c < t.col + t.w);
    // Free intervals of this row once the movable tiles are lifted out.
    const spans: [number, number][] = [];
    for (let c = 0; c < W; ) {
      if (blocked(c)) { c++; continue; }
      const s0 = c;
      while (c < W && !blocked(c)) c++;
      spans.push([s0, c]);
    }
    // Hand the movable tiles to the intervals in order, keeping their minimum widths; then justify each one.
    let k = 0;
    for (const [a, b] of spans) {
      const group: Placed[] = [];
      let need = 0;
      while (k < movable.length && need + movable[k].w <= b - a) { need += movable[k].w; group.push(movable[k++]); }
      if (!group.length) continue;
      const extra = b - a - need;
      let x = a;
      group.forEach((t, i) => {
        t.w += Math.floor(extra / group.length) + (i < extra % group.length ? 1 : 0);
        t.col = x;
        x += t.w;
      });
    }
  }
  // Gaps left (an interval no 1-row tile could take): lengthen the tile above when the cells under it are free.
  for (let r = 1; r < rows; r++) for (let c = 0; c < W; c++) {
    if (occ(r, c)) continue;
    const above = tiles.find((t) => t.row + t.h === r && c >= t.col && c < t.col + t.w);
    if (!above) continue;
    let free = true;
    for (let cc = above.col; cc < above.col + above.w; cc++) if (occ(r, cc)) free = false;
    if (free) above.h += 1;
  }
  let covered = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < W; c++) if (occ(r, c)) covered++;
  return { tiles, rows, fill: rows ? covered / (rows * W) : 0 };
}

/**
 * The tiles of the focused box in a state, for a grid `width` × `height` px. Rows stretch to fill the height
 * (never below TILE.minHeight; then the grid scrolls). Every column count that fits is tried: the one whose
 * tiles are closest to the golden ratio wins, among those that fill at least 85% of the cells.
 */
export function layoutFor(ix: Index, st: State, flat: Flat[], from: number, pos: number, width: number, height: number, minimized = new Set<string>()) {
  const F = st.focus;
  const all = aliveKids(ix, st, F).filter((k) => !minimized.has(k));
  const { active: kids, idle } = splitIdle(ix, st, all);
  // Nothing has content yet (all boxes empty): the view is a plain list; content usage does not apply.
  const allIdle = !kids.some((k) => aliveKids(ix, st, k).length || (st.arts.get(k)?.length ?? 0));
  const span = tileSpans(ix, st, F, kids, flat, from, pos);
  const sized = kids.map((k) => ({ id: k, w: span.get(k)?.[0] ?? 1, h: span.get(k)?.[1] ?? 1 }));
  const plain = kids.map((k) => ({ id: k, w: 1, h: 1 }));
  // Candidates: the importance sizes, all equal, and the most important box as 1×2, 2×2 or 2×1, in its place
  // or first (a tall box on the left suits a wide, short view).
  const top = [...span.keys()][0];
  const cands: { id: string; w: number; h: number }[][] = [plain];
  if (span.size) cands.push(sized);
  if (top) for (const [w, h] of [[1, 2], [2, 2], [2, 1]]) {
    const one = kids.map((k) => ({ id: k, w: k === top ? w : 1, h: k === top ? h : 1 }));
    cands.push(one, [one.find((x) => x.id === top)!, ...one.filter((x) => x.id !== top)]);
  }
  const fit = Math.max(1, Math.floor((width + TILE.gap) / (TILE.minWidth + TILE.gap)));
  const g = TILE.gap;
  let best: ReturnType<typeof measure> | null = null;
  function measure(cols: number, items = sized) {
    const P = placeTiles(items.map((x) => ({ ...x })), cols);
    // Columns have no gap of their own (a tile's side margins make it), so a tile is w units minus one gap.
    const unitW = width / (cols * UNITS);
    const colW = UNITS * unitW - g;
    // The strip of idle boxes takes its rows off the bottom first (its cells follow the bottom row of tiles).
    const strip = stripCells(P.tiles, P.rows, idle.length);
    const H = height - stripHeight(strip);
    const rowH = Math.max(TILE.minHeight, (H - (P.rows - 1) * g) / Math.max(1, P.rows));
    const ratios = P.tiles.map((t) => (t.w * unitW - g) / (t.h * rowH + (t.h - 1) * g));
    // How far the worst tile is from the target shape (in log space, so 2:1 and 1:2 count the same).
    const off = Math.max(0, ...ratios.map((r) => Math.abs(Math.log(r / TILE.target))));
    // Content usage: a tile much bigger than what it holds counts against the layout.
    const usage = P.tiles.map((t) => contentUsage(ix, st, t.id, t.w * unitW - g, t.h * rowH + (t.h - 1) * g));
    const scale = P.tiles.map((t) => contentScale(ix, st, t.id, t.w * unitW - g, t.h * rowH + (t.h - 1) * g));
    const thin = P.tiles.length > 1 && !allIdle ? usage.filter((u) => u < TILE.minUsage).length : 0;
    // Overflow even at the smallest content scale is a hard rule too.
    const over = P.tiles.map((t) => overflows(ix, st, t.id, t.w * unitW - g, t.h * rowH + (t.h - 1) * g));
    const spill = over.filter((o) => o.x || o.y).length;
    // Vertical fill: rows that do not reach the height leave the rest blank.
    const used = Math.min(H, P.rows * rowH + (P.rows - 1) * g);
    const fill = P.fill * (used / H);
    // Shape is a hard rule (each tile out of range costs 10); thin tiles are a soft one (1 each).
    const bad = ratios.filter((r) => r < TILE.minRatio || r > TILE.maxRatio).length;
    return { cols, ...P, fill, colW, rowH, ratios, off: off + thin + 10 * bad + 10 * spill, usage, scale, over, idle, strip, allIdle };
  }
  for (let cols = 1; cols <= Math.min(fit, Math.max(1, kids.length * 2)); cols++) for (const items of cands) {
    const m = measure(cols, items);
    // Prefer layouts that fill enough; among those the best shape; otherwise the fullest.
    const ok = (x: { fill: number }) => x.fill >= 0.85;
    // A layout where nothing overflows beats one that fills more.
    const clean = (x: { over: { x: boolean; y: boolean }[] }) => x.over.every((o) => !o.x && !o.y);
    if (!best || (clean(m) && !clean(best)) || (clean(m) === clean(best) && ((ok(m) && !ok(best)) || (ok(m) === ok(best) && (ok(m) ? m.off < best.off : m.fill > best.fill))))) best = m;
  }
  return best ?? measure(1);
}

/**
 * Build check: at the end of every step of every path, the boxes must fill at least `min` of the focused
 * view, and every tile's width : height must stay within TILE.minRatio … TILE.maxRatio, at the inline and the
 * full-window size of the grid. No tile may overflow (content height, or a title bar on one line) even at
 * TILE.minScale. Returns one message per failing step.
 */
export function lintChronicleLayout(c: Chronicle, sizes: [number, number][] = [[1060, 560], [1380, 720]], min = 0.85): string[] {
  const ix = index(c);
  const errs: string[] = [];
  for (const p of c.paths) {
    const f = flatten(c, p.id);
    const st = fresh(ix);
    let at = 0;
    for (const step of f.steps) {
      for (; at < step.end; at++) apply(ix, st, f.flat[at]);
      const stage = f.flat[step.end - 1].stage;
      if (stage < f.prefix) continue; // a failure path's happy-path prefix is checked with the happy path
      if (!aliveKids(ix, st, st.focus).length) continue; // nothing inside: the view says so; nothing to fill
      for (const [w, h] of sizes) {
        const L = layoutFor(ix, st, f.flat, f.starts[stage], step.end, w, h);
        const where = `${p.id}/${f.stages[stage].id} (step ending at event ${step.end}, ${st.focus}, ${w}×${h})`;
        if (L.fill < min) errs.push(`${where}: ${Math.round(L.fill * 100)}% filled (${L.cols}×${L.rows}), want ${Math.round(min * 100)}%`);
        L.tiles.forEach((t, i) => {
          const r = L.ratios[i];
          if (r < TILE.minRatio || r > TILE.maxRatio) errs.push(`${where}: tile ${t.id} is ${r.toFixed(2)}:1, want ${TILE.minRatio}…${TILE.maxRatio}`);
          if (L.tiles.length > 1 && !L.allIdle && L.usage[i] < TILE.minUsage) errs.push(`${where}: tile ${t.id} content uses ${Math.round(L.usage[i] * 100)}% of it, want ${Math.round(TILE.minUsage * 100)}%`);
          if (L.over[i].y) errs.push(`${where}: tile ${t.id} content overflows its height even at scale ${TILE.minScale}`);
          if (L.over[i].x) errs.push(`${where}: tile ${t.id} title bar or sub line is wider than the tile even at scale ${TILE.minScale} (sub at ${TILE.subMinPx} px)`);
        });
      }
    }
  }
  return errs;
}

/**
 * Build check for a static Chronicle (no playback: the reader only maximizes, minimizes and restores): in the
 * final state of the happy path, every box that has boxes inside is a view the reader can open, so each one is
 * checked as the focused box with the same rules as lintChronicleLayout: fill, tile shape, content usage and
 * overflow, at the inline and the full-window size. Returns one message per failing view.
 */
export function lintChronicleWindows(c: Chronicle, sizes: [number, number][] = [[1060, 560], [1380, 720]], min = 0.85): string[] {
  const ix = index(c);
  const f = flatten(c, c.paths[0].id);
  const st = fresh(ix);
  for (const x of f.flat) apply(ix, st, x);
  const errs: string[] = [];
  for (const b of c.boxes) {
    if (!st.alive.has(b.id) || !aliveKids(ix, st, b.id).length) continue;
    st.focus = b.id;
    for (const [w, h] of sizes) {
      const L = layoutFor(ix, st, f.flat, 0, f.flat.length, w, h);
      const where = `view ${b.id} (${w}×${h})`;
      if (L.fill < min) errs.push(`${where}: ${Math.round(L.fill * 100)}% filled (${L.cols}×${L.rows}), want ${Math.round(min * 100)}%`);
      L.tiles.forEach((t, i) => {
        const r = L.ratios[i];
        if (r < TILE.minRatio || r > TILE.maxRatio) errs.push(`${where}: tile ${t.id} is ${r.toFixed(2)}:1, want ${TILE.minRatio}…${TILE.maxRatio}`);
        if (L.tiles.length > 1 && !L.allIdle && L.usage[i] < TILE.minUsage) errs.push(`${where}: tile ${t.id} content uses ${Math.round(L.usage[i] * 100)}% of it, want ${Math.round(TILE.minUsage * 100)}%`);
        if (L.over[i].y) errs.push(`${where}: tile ${t.id} content overflows its height even at scale ${TILE.minScale}`);
        if (L.over[i].x) errs.push(`${where}: tile ${t.id} title bar or sub line is wider than the tile even at scale ${TILE.minScale} (sub at ${TILE.subMinPx} px)`);
      });
    }
  }
  return errs;
}
