/**
 * Graph layout: size nodes from their text, place them with TALA
 * (tools/tala-layout), and keep the candidate that fits the column best.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GraphSpec } from './spec';
import { T, type Scene, type SceneEdge, type SceneGroup, type SceneNode, type TextBlock, type Pt } from './scene';
import { measure, wrap, widest } from './text';
import { collisionCount } from './labels';
import { between, degenerate, diagonal, grazed } from './wires';
import { lintScene, lintAspect } from './lint';

const ROOT = process.cwd();
// Windows only spawns executables that carry an .exe extension.
const TALA = join(ROOT, '.tools', process.platform === 'win32' ? 'tala-layout.exe' : 'tala-layout');
const CACHE = join(ROOT, 'node_modules', '.cache', 'tala');
const toolRev = () =>
  createHash('sha256')
    .update(readFileSync(join(ROOT, 'tools/tala-layout/main.go')))
    .update(readFileSync(join(ROOT, 'tools/tala-layout/go.sum')))
    .digest('hex')
    .slice(0, 12);

interface TalaOut {
  width: number;
  height: number;
  nodes: { id: string; x: number; y: number; w: number; h: number }[];
  groups: { id: string; x: number; y: number; w: number; h: number }[];
  edges: { id: string; points: Pt[]; label?: Pt }[];
}

let warned = false;
/** TALA is optional: without the Go tool, graphs use the columns layout. */
const talaAvailable = () => {
  if (existsSync(TALA)) return true;
  if (!warned) console.warn('[diagrams] .tools/tala-layout not built (needs Go >= 1.27); graphs use the columns layout');
  warned = true;
  return false;
};

function tala(input: unknown): TalaOut {
  const json = JSON.stringify(input);
  const key = createHash('sha256').update(toolRev()).update('\0').update(json).digest('hex').slice(0, 32);
  const file = join(CACHE, `${key}.json`);
  if (existsSync(file)) return normalise(JSON.parse(readFileSync(file, 'utf8')));
  let out: string;
  try {
    out = execFileSync(TALA, [], { input: json, encoding: 'utf8', timeout: 120_000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error((err.stderr || err.message).trim());
  }
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, out);
  return normalise(JSON.parse(out));
}

/** Go encodes empty slices as null. */
const normalise = (o: TalaOut): TalaOut => ({ ...o, nodes: o.nodes ?? [], groups: o.groups ?? [], edges: (o.edges ?? []).map((e) => ({ ...e, points: e.points ?? [] })) });

const upperWidth = (s: string, size: number, weight: 600, tracking: number) =>
  measure(s.toUpperCase(), size, weight) + tracking * size * s.length;

function block(s: string, max: number, t: { size: number; weight: 400 | 500 | 600 | 700; lineHeight: number }): TextBlock {
  return { lines: wrap(s, max, t.size, t.weight), size: t.size, weight: t.weight, lineHeight: t.lineHeight };
}

/** Text a Step `state` swaps into a box (Diagram.astro collects these before layout). */
export interface AltText { label?: string; detail?: string; tag?: string }
/** A spec node plus the step texts it must also fit (`alts`, not part of the schema). */
type SizedNode = GraphSpec['nodes'][number] & { alts?: AltText[] };

/** Box padding: `tight` for edge-free `layers` stacks (boxes only), which need no room for wires. */
const PAD = { normal: { x: T.padX, y: T.padY, minW: T.minNodeW }, tight: { x: 10, y: 7, minW: 80 } };

function sizeText(label: string, detailS: string | undefined, tagS: string | undefined, shape: string, k: number, tight = false) {
  const P = tight ? PAD.tight : PAD.normal;
  const lab = block(label, 180 * k, T.label);
  const detail = detailS ? block(detailS, 200 * k, T.detail) : undefined;
  const tag = tagS ? { lines: [tagS], size: T.tag.size, weight: T.tag.weight, lineHeight: T.tag.lineHeight, upper: true } : undefined;
  const textW = Math.max(
    widest(lab.lines, T.label.size, T.label.weight),
    detail ? widest(detail.lines, T.detail.size, T.detail.weight) : 0,
    tag ? upperWidth(tagS!, T.tag.size, T.tag.weight, T.tag.tracking) : 0,
  );
  const textH = (tag ? T.tag.lineHeight + T.gap : 0) + lab.lines.length * T.label.lineHeight + (detail ? T.gap + detail.lines.length * T.detail.lineHeight : 0);
  const extraY = shape === 'store' ? 16 : 0;
  const extraX = shape === 'pill' ? 12 : 0;
  return {
    tag, label: lab, detail, pad: tight ? { x: P.x, y: P.y } : undefined,
    w: Math.ceil(Math.max(P.minW, textW + 2 * P.x + extraX)),
    h: Math.ceil(textH + 2 * P.y + extraY),
  };
}

/**
 * A box's size: big enough for its own text and for every text a step swaps in
 * (so a step never makes text run out of the box). The drawn text is its own.
 */
function sizeNode(n: SizedNode, k: number, tight = false) {
  const shape = n.shape ?? 'box';
  const base = sizeText(n.label, n.detail, n.tag, shape, k, tight);
  for (const a of n.alts ?? []) {
    const v = sizeText(a.label ?? n.label, a.detail ?? n.detail, a.tag ?? n.tag, shape, k, tight);
    base.w = Math.max(base.w, v.w);
    base.h = Math.max(base.h, v.h);
  }
  return base;
}

export function edgeIds<E extends { id?: string; from: string; to: string }>(edges: E[]): string[] {
  const seen = new Map<string, number>();
  return edges.map((e) => {
    if (e.id) return e.id;
    const base = `${e.from} -> ${e.to}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} #${n}`;
  });
}

function orderGroups(groups: GraphSpec['groups']): GraphSpec['groups'] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const out: GraphSpec['groups'] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (g: GraphSpec['groups'][number]) => {
    if (state.get(g.id) === 2) return;
    if (state.get(g.id) === 1) throw new Error(`group cycle at ${g.id}`);
    state.set(g.id, 1);
    if (g.parent) {
      const p = byId.get(g.parent);
      if (!p) throw new Error(`group ${g.id}: unknown parent ${g.parent}`);
      visit(p);
    }
    state.set(g.id, 2);
    out.push(g);
  };
  groups.forEach(visit);
  return out;
}

/** `groupDir`: direction for groups that set none (TALA lays groups out 'down' otherwise). */
function candidate(spec: GraphSpec, direction: 'right' | 'down', k: number, groupDir?: 'right' | 'down'): Scene {
  const groups = orderGroups(spec.groups);
  const groupIds = new Set(groups.map((g) => g.id));
  const sized = new Map(spec.nodes.map((n) => [n.id, sizeNode(n, k)]));
  for (const n of spec.nodes) {
    if (groupIds.has(n.id)) throw new Error(`id ${n.id} is both a node and a group`);
    if (n.parent && !groupIds.has(n.parent)) throw new Error(`node ${n.id}: unknown parent group ${n.parent}`);
  }
  const ids = edgeIds(spec.edges);
  const groupLabel = (g: GraphSpec['groups'][number]): TextBlock | undefined =>
    g.label ? { lines: [g.label], size: T.group.size, weight: T.group.weight, lineHeight: T.group.lineHeight, upper: true } : undefined;
  const edgeLabel = (s: string) => {
    const text = block(s, 150, T.edge);
    return { text, w: Math.ceil(widest(text.lines, T.edge.size, T.edge.weight) + 12), h: text.lines.length * T.edge.lineHeight + 6 };
  };
  const input = {
    direction,
    seeds: [1, 2, 3],
    groups: groups.map((g) => {
      const l = groupLabel(g);
      return {
        id: g.id,
        parent: g.parent ?? '',
        labelW: l ? Math.ceil(upperWidth(g.label!, T.group.size, T.group.weight, T.group.tracking) + 20) : 0,
        labelH: l ? 26 : 0,
        direction: g.direction ?? groupDir ?? '',
      };
    }),
    nodes: spec.nodes.map((n) => {
      const s = sized.get(n.id)!;
      return { id: n.id, parent: n.parent ?? '', w: s.w, h: s.h, shape: n.shape === 'store' ? 'cylinder' : 'rectangle' };
    }),
    edges: spec.edges.map((e, i) => {
      const l = e.label ? edgeLabel(e.label) : undefined;
      return { id: ids[i], from: e.from, to: e.to, labelW: l?.w ?? 0, labelH: l?.h ?? 0, arrow: e.arrow ?? 'end' };
    }),
  };
  const out = tala(input);
  const pos = new Map([...out.nodes, ...out.groups].map((b) => [b.id, b]));
  const pad = 12;
  const routes = new Map(out.edges.map((e) => [e.id, e]));
  // TALA may grow a box to fit its ports. Shrink every box to its natural size,
  // centred in TALA's slot. An edge end that still meets the smaller box slides
  // along its last segment onto the new border; one that would miss it gets a
  // periscope: a short jog just outside the box, then straight in.
  const pts = new Map(spec.edges.map((e, i) => [ids[i], routes.get(ids[i])!.points.map(([x, y]) => [x + pad, y + pad] as Pt)]));
  const ends = new Map<string, { id: string; at: 0 | -1 }[]>();
  spec.edges.forEach((e, i) => {
    if (pts.get(ids[i])!.length < 2) return;
    (ends.get(e.from) ?? ends.set(e.from, []).get(e.from)!).push({ id: ids[i], at: 0 });
    (ends.get(e.to) ?? ends.set(e.to, []).get(e.to)!).push({ id: ids[i], at: -1 });
  });
  const JOG = 18, INSET = 6, SNAP = 18;
  const nodes: SceneNode[] = spec.nodes.map((n) => {
    const b = pos.get(n.id)!;
    const s = sized.get(n.id)!;
    const x = b.x + pad, y = b.y + pad, w = b.w, h = b.h;
    const W = Math.min(w, s.w), H = Math.min(h, s.h);
    const X = x + (w - W) / 2, Y = y + (h - H) / 2;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    for (const m of ends.get(n.id) ?? []) {
      let p = pts.get(m.id)!;
      if (m.at === -1) p = [...p].reverse();
      const [a, c] = [p[0], p[1]];
      if (Math.abs(a[0] - c[0]) < 0.5) {
        // Enters through the top or bottom.
        const by = c[1] < a[1] ? Y : Y + H, out = c[1] < a[1] ? -JOG : JOG;
        const tx = clamp(a[0], X + INSET, X + W - INSET);
        if (tx === a[0]) p = [[a[0], by], ...p.slice(1)];
        // Small miss: shift the whole last run sideways (no tiny jog), when the run before it is horizontal.
        else if (Math.abs(tx - a[0]) < SNAP && p.length >= 3 && Math.abs(p[2][1] - c[1]) < 0.5) p = [[tx, by], [tx, c[1]], ...p.slice(2)];
        else p = [[tx, by], [tx, by + out], [a[0], by + out], ...p.slice(1)];
      } else if (Math.abs(a[1] - c[1]) < 0.5) {
        // Enters through a side.
        const bx = c[0] < a[0] ? X : X + W, out = c[0] < a[0] ? -JOG : JOG;
        const ty = clamp(a[1], Y + INSET, Y + H - INSET);
        if (ty === a[1]) p = [[bx, a[1]], ...p.slice(1)];
        // Small miss: shift the whole last run up or down (no tiny jog), when the run before it is vertical.
        else if (Math.abs(ty - a[1]) < SNAP && p.length >= 3 && Math.abs(p[2][0] - c[0]) < 0.5) p = [[bx, ty], [c[0], ty], ...p.slice(2)];
        else p = [[bx, ty], [bx + out, ty], [bx + out, a[1]], ...p.slice(1)];
      }
      pts.set(m.id, m.at === -1 ? p.reverse() : p);
    }
    return { id: n.id, x: X, y: Y, w: W, h: H, shape: n.shape ?? 'box', parent: n.parent, info: n.info, tone: n.tone ?? 'neutral', tag: s.tag, label: s.label, detail: s.detail, pad: s.pad };
  });
  const sceneGroups: SceneGroup[] = groups.map((g) => {
    const b = pos.get(g.id)!;
    return { id: g.id, x: b.x + pad, y: b.y + pad, w: b.w, h: b.h, tone: g.tone ?? 'muted', label: groupLabel(g), parent: g.parent };
  });
  const edges: SceneEdge[] = spec.edges.map((e, i) => {
    const r = routes.get(ids[i])!;
    const l = e.label ? edgeLabel(e.label) : undefined;
    return {
      id: ids[i], from: e.from, to: e.to,
      points: simplify(pts.get(ids[i])!),
      tone: e.tone ?? 'neutral',
      dashed: e.style === 'dashed', info: e.info,
      arrowEnd: (e.arrow ?? 'end') !== 'none',
      arrowStart: e.arrow === 'both',
      label: l && r.label ? { x: r.label[0] + pad, y: r.label[1] + pad, w: l.w, h: l.h, text: l.text } : undefined,
    };
  });
  return { kind: 'graph', width: Math.ceil(out.width + 2 * pad), height: Math.ceil(out.height + 2 * pad), groups: sceneGroups, nodes, edges, lifelines: [] };
}

const fitScale = (s: Scene) => Math.min(1, T.fitW / s.width, T.fitH / s.height);
/** A band/side node linked to 3+ distinct boxes: drawn as a bus across the columns. */
export const isBusNode = (spec: GraphSpec, id: string) =>
  new Set(spec.edges.flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : []))).size >= 3;

/** Distance of a scene's shape from 16:8 (2:1), in log space (0 = exactly 2:1). */
const aspectGap = (s: Scene) => Math.abs(Math.log(s.width / s.height / 2));

/**
 * One cost per candidate: lint failures first (collisions, short runs, aspect),
 * then shrink to fit the column and distance from 16:8 together, so a slightly
 * smaller 2:1 layout beats a full-size square or strip.
 */
const cost = (spec: GraphSpec, s: Scene) => {
  const hard = collisionCount(s) * 100 + lintScene(spec, s).length * 50 + (lintAspect(spec, s) ? 10 : 0);
  return hard - Math.log(fitScale(s)) + 0.5 * aspectGap(s) + 0.02 * Math.log((s.width * s.height) / 1e5);
};
const pick = (spec: GraphSpec, all: Scene[]) => {
  const scored = all.map((s) => ({ s, c: cost(spec, s) }));
  return scored.reduce((best, x) => (x.c < best.c - 1e-9 ? x : best)).s;
};

/** Hues for `wires: 'nets'`, in order of first use; semantic tones (good, risk) left out. */
const NET_TONES = ['primary', 'peach', 'teal', 'pink', 'lime', 'violet', 'sky', 'warn'] as const;
function withNets(spec: GraphSpec): GraphSpec {
  if (spec.wires !== 'nets') return spec;
  const hue = new Map<string, (typeof NET_TONES)[number]>();
  for (const e of spec.edges) if (!e.tone && !hue.has(e.from)) hue.set(e.from, NET_TONES[hue.size % NET_TONES.length]);
  return { ...spec, edges: spec.edges.map((e) => (e.tone ? e : { ...e, tone: hue.get(e.from) })) };
}

export function layoutGraph(input: GraphSpec): Scene {
  const spec = withNets(input);
  const scene = layoutAny(spec);
  return spec.wires === 'nets' ? { ...scene, wires: 'nets' } : scene;
}

function layoutAny(spec: GraphSpec): Scene {
  if (spec.layout === 'layers') {
    // One row per top group, stacked; every group as a horizontal row; equal widths.
    const probe = columns(spec, 1, Infinity, new Set());
    const rows = new Set(probe.info.map((_, i) => i));
    // Boxes only (no edges): full wrap width; narrowing it only buys aspect by wrapping labels.
    const ks = spec.edges.length === 0 ? [1] : [1, 0.9, 0.8];
    return pick(spec, ks.map((k) => columns(spec, k, 1, rows, true).scene));
  }
  const all: Scene[] = [];
  if (spec.layout !== 'tala' || !talaAvailable()) all.push(...columnVariants(spec), ...hintVariants(spec).flatMap(columnVariants));
  if (spec.layout !== 'columns' && talaAvailable()) {
    const dirs: ('right' | 'down')[] = spec.direction === 'auto' ? ['right', 'down'] : [spec.direction];
    for (const d of dirs) for (const g of [undefined, 'right', 'down'] as const) for (const k of [1, 0.78]) all.push(candidate(spec, d, k, g));
  }
  return pick(spec, all);
}

/**
 * Spec rewrites the columns layout also tries (what authors did by hand):
 * hub nodes (loose, linked to 2+ top groups) as bands (sources above, sinks
 * below) or side strips; existing bands as sides and sides as bands; every top
 * group as a row or as a stack.
 */
function hintVariants(spec: GraphSpec): GraphSpec[] {
  type N = GraphSpec['nodes'][number];
  const out: GraphSpec[] = [];
  const parentOf = new Map(spec.groups.map((g) => [g.id, g.parent]));
  const top = (g?: string) => { let c = g; for (let i = 0; c && parentOf.get(c) && i < 64; i++) c = parentOf.get(c); return c; };
  const topOf = new Map(spec.nodes.map((n) => [n.id, top(n.parent) ?? `_${n.id}`]));
  const hubs = new Map<string, boolean>();
  for (const n of spec.nodes) {
    if (n.parent || n.band || n.side) continue;
    const es = spec.edges.filter((e) => e.from === n.id || e.to === n.id);
    if (new Set(es.map((e) => topOf.get(e.from === n.id ? e.to : e.from))).size < 2) continue;
    const outs = es.filter((e) => e.from === n.id).length;
    hubs.set(n.id, outs >= es.length - outs);
  }
  const map = (f: (n: N) => N): GraphSpec => ({ ...spec, nodes: spec.nodes.map(f) });
  if (hubs.size && spec.groups.length) {
    out.push(map((n) => (hubs.has(n.id) ? { ...n, band: hubs.get(n.id) ? -1 : 1 } : n)));
    out.push(map((n) => (hubs.has(n.id) ? { ...n, side: hubs.get(n.id) ? -1 : 1 } : n)));
  }
  if (spec.nodes.some((n) => n.band)) out.push(map((n) => (n.band ? { ...n, band: undefined, side: n.band } : n)));
  if (spec.nodes.some((n) => n.side)) out.push(map((n) => (n.side ? { ...n, side: undefined, band: n.side } : n)));
  if (spec.groups.some((g) => !g.parent)) {
    for (const direction of ['right', 'down'] as const) out.push({ ...spec, groups: spec.groups.map((g) => (g.parent ? g : { ...g, direction })) });
  }
  return out;
}

/**
 * Column layouts to choose from: for each text width, start with every group
 * stacked, then greedily lay out whichever group as a horizontal row improves
 * the fit most, until nothing improves. Each try also searches the row count.
 */
function columnVariants(spec: GraphSpec): Scene[] {
  const out: Scene[] = [];
  for (const k of [0.9, 0.75]) {
    const probe = columns(spec, k, Infinity, new Set());
    const forced = new Set(probe.info.flatMap((c, i) => (c.dir === 'right' && c.canRow ? [i] : [])));
    const free = probe.info.flatMap((c, i) => (c.canRow && !c.dir ? [i] : []));
    const bestFor = (h: Set<number>) => {
      const n = probe.cols;
      const tries: Scene[] = [];
      for (let perRow = n; perRow >= 1; perRow--) {
        if (perRow < n && Math.ceil(n / perRow) === Math.ceil(n / (perRow + 1))) continue;
        tries.push(columns(spec, k, perRow, h).scene);
      }
      return pick(spec, tries);
    };
    let horiz = new Set(forced);
    let best = bestFor(horiz);
    for (let round = 0; round < free.length; round++) {
      let gain: { s: Scene; h: Set<number> } | undefined;
      for (const i of free) {
        if (horiz.has(i)) continue;
        const h = new Set([...horiz, i]);
        const sc = bestFor(h);
        if (pick(spec, [gain?.s ?? best, sc]) === sc) gain = { s: sc, h };
      }
      if (!gain) break;
      best = gain.s;
      horiz = gain.h;
    }
    out.push(best);
  }
  return out;
}

/**
 * Pipeline layout. Top-level groups (and loose nodes) become columns in spec
 * order; members stack in spec order and share the column width. Columns wrap
 * into rows to fit T.fitW. Nested groups are flattened into their top group.
 */
interface ColInfo { canRow: boolean; dir?: 'right' | 'down' }
/** `horiz`: column indices whose members sit in one horizontal row. */
function columns(spec: GraphSpec, k: number, perRow: number, horiz: Set<number>, equal = false): { scene: Scene; cols: number; info: ColInfo[] } {
  const groups = orderGroups(spec.groups);
  const top = (g: string | undefined): string | undefined => {
    let cur = g;
    for (let i = 0; cur && i < 64; i++) {
      const p = groups.find((x) => x.id === cur)?.parent;
      if (!p) return cur;
      cur = p;
    }
    return cur;
  };
  // An edge-free `layers` stack is boxes only: no wires to route, so tighter boxes and gaps.
  const tight = equal && spec.edges.length === 0;
  const sized = new Map(spec.nodes.map((n) => [n.id, sizeNode(n, k, tight)]));
  type Col = { group?: GraphSpec['groups'][number]; nodes: GraphSpec['nodes'] };
  const cols: Col[] = [];
  const colOf = new Map<string, Col>();
  for (const n of spec.nodes) {
    if (n.band || n.side) continue;
    const g = top(n.parent);
    let col = g ? colOf.get(g) : undefined;
    if (!col) {
      col = { group: g ? groups.find((x) => x.id === g) : undefined, nodes: [] };
      cols.push(col);
      if (g) colOf.set(g, col);
    }
    col.nodes.push(n);
  }
  const ids = edgeIds(spec.edges);
  // A gap that carries a labelled edge is the label plus LABEL_CLEAR (half each side), so the
  // label sits on a free stretch of its line, clear of the arrowhead and the box (labels.ts lints it).
  const LABEL_CLEAR = 36;
  const labelOf = (s: string) => {
    const text = block(s, 140, T.edge);
    return { text, w: Math.ceil(widest(text.lines, T.edge.size, T.edge.weight) + 12), h: text.lines.length * T.edge.lineHeight + 6 };
  };
  // HEAD leaves room under a group label for an edge to turn into the first box;
  // GPB below the last box for an edge to leave downward (see T.minSeg / T.minLast).
  // `layers` (equal): a compact stack, so five layers still read as one picture.
  const GP = tight ? 10 : 14, GPB = tight ? 10 : equal ? 16 : 28, HEAD = tight ? 30 : equal ? 38 : 46, VGAP = 40, CGAP = 44,
    RGAP = tight ? 10 : equal ? 18 : 48, pad = 12, SUBPAD = 10, SUBHEAD = 26;
  // A node's sub-group: its own group when that group is nested inside the column's group.
  const sub = (n: GraphSpec['nodes'][number]) => (n.parent && top(n.parent) !== n.parent ? n.parent : undefined);
  const hasSubs = (c: Col) => c.nodes.some((n) => sub(n));
  /** Extra vertical space before node j (sub-group headers and footers). */
  const subGap = (c: Col, j: number) => {
    const a = j > 0 ? sub(c.nodes[j - 1]) : undefined, b = sub(c.nodes[j]);
    if (a === b) return 0;
    return (a ? SUBPAD : 0) + (b ? SUBHEAD : 0);
  };
  const HGAP0 = tight ? 20 : 40;
  const isRow = (i: number) => horiz.has(i) && cols[i].nodes.length > 1 && !hasSubs(cols[i]);
  /** Gap between members of a horizontal group: wide enough for edge labels between them. */
  const hgap = cols.map((c) => {
    const inGroup = new Set(c.nodes.map((n) => n.id));
    const widest = Math.max(0, ...spec.edges.filter((e) => e.label && inGroup.has(e.from) && inGroup.has(e.to)).map((e) => labelOf(e.label!).w));
    return Math.max(HGAP0, widest + LABEL_CLEAR);
  });
  const memberH = (c: Col) => Math.max(...c.nodes.map((n) => sized.get(n.id)!.h));
  // A column is also wide enough for its group's title on one line (lintTextFit checks it).
  const groupTitleW = (label?: string) => (label ? Math.ceil(measure(label.toUpperCase(), T.group.size, T.group.weight) * 1.08) + 26 : 0);
  // Sub-group titles too: a sub-group sits 2·GP inside its column.
  const titleW = (c: Col) => Math.max(groupTitleW(c.group?.label),
    ...groups.filter((g) => g.parent && c.group && top(g.id) === c.group.id).map((g) => groupTitleW(g.label) + 2 * GP));
  const rowW = (i: number) => cols[i].nodes.reduce((sum, n) => sum + sized.get(n.id)!.w, 0) + hgap[i] * (cols[i].nodes.length - 1);
  const natW = cols.map((c, i) => Math.max(titleW(c),
    isRow(i)
      ? rowW(i) + (c.group ? 2 * GP : 0)
      : Math.max(...c.nodes.map((n) => sized.get(n.id)!.w)) + (hasSubs(c) ? 2 * SUBPAD : 0) + (c.group ? 2 * GP : 0)));
  // `layers`: every row group as wide as the widest (its boxes centred, below).
  const colW = equal ? natW.map(() => Math.max(...natW)) : natW;
  // In-column edge labels need taller gaps.
  const inColLabel = new Map<string, number>();
  spec.edges.forEach((e) => {
    if (!e.label) return;
    const a = spec.nodes.find((n) => n.id === e.from), b = spec.nodes.find((n) => n.id === e.to);
    if (a && b && top(a.parent) === top(b.parent)) inColLabel.set(`${e.from}|${e.to}`, labelOf(e.label).h);
  });
  const colH = cols.map((c, ci) => isRow(ci) ? memberH(c) + (c.group ? HEAD + GPB : 0) : 
    c.nodes.reduce((h, n, i) => {
      const prev = c.nodes[i - 1];
      const gap = (i === 0 ? 0 : VGAP + (inColLabel.get(`${prev.id}|${n.id}`) ?? 0)) + subGap(c, i);
      return h + gap + sized.get(n.id)!.h;
    }, 0) + (sub(c.nodes[c.nodes.length - 1]) ? SUBPAD : 0) + (c.group ? HEAD + GPB : 0));
  // Wrap columns into rows of `perRow`, balanced.
  const nRows = Math.ceil(cols.length / Math.min(perRow, cols.length));
  const per = Math.ceil(cols.length / nRows);
  const rows: number[][] = Array.from({ length: nRows }, (_, r) => cols.map((_, i) => i).slice(r * per, (r + 1) * per)).filter((r) => r.length);
  const boxes = new Map<string, Box>();
  const where = new Map<string, { row: number; col: number; colRight: number; rowBottom: number }>();
  const sceneGroups: SceneGroup[] = [];
  // Bands: full-width rows above (negative) and below (positive) the columns.
  const bandIds = [...new Set(spec.nodes.filter((n) => n.band).map((n) => n.band!))].sort((a, b) => a - b);
  // Side strips: full-height columns left (negative) and right (positive).
  const sideIds = [...new Set(spec.nodes.filter((n) => n.side).map((n) => n.side!))].sort((a, b) => a - b);
  const sideNodes = (sd: number) => spec.nodes.filter((n) => n.side === sd);
  const sideW = (sd: number) => Math.max(...sideNodes(sd).map((n) => sized.get(n.id)!.w));
  /** Gap on a side strip's inner edge: wide enough for the labels of edges leaving it. */
  const sideGap = (sd: number) => {
    const ids = new Set(sideNodes(sd).map((n) => n.id));
    const w = Math.max(0, ...spec.edges.filter((e) => e.label && ids.has(e.from) !== ids.has(e.to)).map((e) => labelOf(e.label!).w));
    return Math.max(CGAP, w + LABEL_CLEAR);
  };
  const leftW = sideIds.filter((sd) => sd < 0).reduce((sum, sd) => sum + sideW(sd) + sideGap(sd), 0);
  const bandH = (b: number) => Math.max(...spec.nodes.filter((n) => n.band === b).map((n) => sized.get(n.id)!.h));
  let y = pad, width = 0;
  for (const b of bandIds.filter((b) => b < 0)) y += bandH(b) + RGAP;
  const colTop = y;
  const rowH_ = rows.map((row) => Math.max(...row.map((i) => colH[i])));
  /** Gap between neighbouring columns: wide enough for the labels of edges crossing it. */
  const colGap = (i: number, j: number) => {
    const a = new Set(cols[i].nodes.map((n) => n.id)), b = new Set(cols[j].nodes.map((n) => n.id));
    const w = Math.max(0, ...spec.edges.filter((e) => e.label && ((a.has(e.from) && b.has(e.to)) || (b.has(e.from) && a.has(e.to)))).map((e) => labelOf(e.label!).w));
    return Math.max(CGAP, w + LABEL_CLEAR);
  };
  /** Gap below row r (`layers`, compact by default): taller when a labelled edge runs to the next row. */
  const rowGap = (r: number) => {
    if (!equal || r >= rows.length - 1) return RGAP; // columns already leave RGAP (48px) between rows
    const inRow = (k: number) => new Set(rows[k].flatMap((i) => cols[i].nodes.map((n) => n.id)));
    const a = inRow(r), b = inRow(r + 1);
    const h = Math.max(0, ...spec.edges.filter((e) => e.label && ((a.has(e.from) && b.has(e.to)) || (b.has(e.from) && a.has(e.to)))).map((e) => labelOf(e.label!).h));
    return h ? Math.max(RGAP, h + LABEL_CLEAR) : RGAP;
  };
  rows.forEach((row, r) => {
    let x = pad + leftW;
    const rowH = rowH_[r];
    for (const [k, i] of row.entries()) {
      const c = cols[i];
      const gap = k < row.length - 1 ? colGap(i, row[k + 1]) : CGAP;
      const inner = c.group ? GP : 0;
      // Each column keeps its own height, centred in the row: a short column is not
      // stretched to the tallest one (lintGroupFit checks this); edges between
      // columns at different heights dog-leg in the gap.
      const dy = (rowH - colH[i]) / 2;
      if (c.group) {
        sceneGroups.push({
          id: c.group.id, x, y: y + dy, w: colW[i], h: colH[i], tone: c.group.tone ?? 'muted', parent: undefined,
          label: c.group.label ? { lines: wrap(c.group.label.toUpperCase(), colW[i] - 2 * GP, T.group.size, T.group.weight).slice(0, 1), size: T.group.size, weight: T.group.weight, lineHeight: T.group.lineHeight, upper: true } : undefined,
        });
      }
      if (isRow(i)) {
        // Centred when the row group is wider than its boxes (`layers`).
        let nx = x + inner + Math.max(0, (colW[i] - 2 * inner - rowW(i)) / 2);
        const ny0 = y + dy + (c.group ? HEAD : 0), rh = memberH(c);
        c.nodes.forEach((n, j) => {
          // Own height, centred in the row (not stretched to the tallest neighbour).
          const w = sized.get(n.id)!.w, h = sized.get(n.id)!.h;
          boxes.set(n.id, { x: nx, y: ny0 + (rh - h) / 2, w, h });
          where.set(n.id, { row: r, col: i * 1000 + j + 1, colRight: nx + w + (hgap[i] - CGAP) / 2, rowBottom: y + rowH_[r] });
          nx += w + hgap[i];
        });
        if (c.group) where.set(c.group.id, { row: r, col: i, colRight: x + colW[i], rowBottom: y + rowH_[r] });
        x += colW[i] + gap;
        continue;
      }
      let ny = y + dy + (c.group ? HEAD : 0);
      c.nodes.forEach((n, j) => {
        if (j > 0) ny += VGAP + (inColLabel.get(`${c.nodes[j - 1].id}|${n.id}`) ?? 0);
        ny += subGap(c, j);
        const h = sized.get(n.id)!.h;
        const inset = hasSubs(c) ? SUBPAD : 0;
        // Each box keeps its own width, centred in the column: a long group label or
        // a wide neighbour widens the column, not the box (lintBoxFit checks this).
        const avail = colW[i] - 2 * inner - 2 * inset;
        const bw = Math.min(avail, sized.get(n.id)!.w);
        boxes.set(n.id, { x: x + inner + inset + (avail - bw) / 2, y: ny, w: bw, h });
        where.set(n.id, { row: r, col: i, colRight: x + colW[i], rowBottom: y + rowH });
        ny += h;
      });
      if (c.group) where.set(c.group.id, { row: r, col: i, colRight: x + colW[i], rowBottom: y + rowH });
      x += colW[i] + gap;
    }
    width = Math.max(width, x - CGAP + pad);
    y += rowH + rowGap(r);
  });
  // Place the side strips over the full height of the columns.
  const colBottom = Math.max(colTop + 40, y - RGAP);
  if (!rows.length || !cols.length) width = Math.max(width, pad + leftW - CGAP + pad);
  const isBus = (id: string) => isBusNode(spec, id);
  const placeSide = (sd: number, sx: number) => {
    const ns = sideNodes(sd), w = sideW(sd);
    if (ns.length === 1) {
      // A bus (linked to 3+ boxes: switch, shared store) spans the columns' full
      // height so every column plugs into it; anything else keeps its natural
      // height, centred, and edges reach it with a dog-leg.
      const h = isBus(ns[0].id) ? colBottom - colTop : sized.get(ns[0].id)!.h;
      boxes.set(ns[0].id, { x: sx, y: colTop + Math.max(0, (colBottom - colTop - h) / 2), w, h });
      where.set(ns[0].id, { row: 0, col: -300 - sd, colRight: sx + w, rowBottom: colBottom });
      return;
    }
    const total = ns.reduce((sum, n) => sum + sized.get(n.id)!.h, 0) + VGAP * (ns.length - 1);
    let sy = colTop + Math.max(0, (colBottom - colTop - total) / 2);
    ns.forEach((n, k) => {
      const h = sized.get(n.id)!.h;
      boxes.set(n.id, { x: sx, y: sy, w, h });
      where.set(n.id, { row: 0, col: -300 - sd * 10 - k, colRight: sx + w, rowBottom: colBottom });
      sy += h + VGAP;
    });
  };
  let lx = pad;
  for (const sd of sideIds.filter((v) => v < 0)) { placeSide(sd, lx); lx += sideW(sd) + sideGap(sd); }
  let rx = width - pad;
  for (const sd of sideIds.filter((v) => v > 0)) { rx += sideGap(sd); placeSide(sd, rx); rx += sideW(sd); }
  if (sideIds.some((v) => v > 0)) width = rx + pad;
  /** Gap between neighbouring band boxes: wide enough for the labels of edges between them. */
  const pairGap = (a: string, b: string) => {
    const w = Math.max(0, ...spec.edges.filter((e) => e.label && ((e.from === a && e.to === b) || (e.from === b && e.to === a))).map((e) => labelOf(e.label!).w));
    return Math.max(CGAP, w + LABEL_CLEAR);
  };
  const bandGaps = (ns: GraphSpec['nodes']) => ns.slice(1).reduce((s, n, k) => s + pairGap(ns[k].id, n.id), 0);
  const colsW = Math.max(width, ...bandIds.map((b) => { const ns = spec.nodes.filter((n) => n.band === b); return ns.reduce((s, n) => s + sized.get(n.id)!.w, 0) + bandGaps(ns) + 2 * pad; }));
  width = colsW;
  if (!rows.length || !cols.length) y = colTop + RGAP;
  const placeBand = (b: number, top: number, rowIndex: number) => {
    const ns = spec.nodes.filter((n) => n.band === b);
    const h = bandH(b);
    if (ns.length === 1) {
      // A bus spans the full width; anything else keeps its natural width, centred.
      const w = isBus(ns[0].id) ? width - 2 * pad : sized.get(ns[0].id)!.w;
      const bx = Math.max(pad, (width - w) / 2);
      boxes.set(ns[0].id, { x: bx, y: top, w, h });
      where.set(ns[0].id, { row: rowIndex, col: -100 - b, colRight: bx + w, rowBottom: top + h });
      return;
    }
    const total = ns.reduce((s, n) => s + sized.get(n.id)!.w, 0) + bandGaps(ns);
    let x = Math.max(pad, (width - total) / 2);
    ns.forEach((n, k) => {
      // Own height, centred in the band (the band is as tall as its tallest box).
      const w = sized.get(n.id)!.w, nh = sized.get(n.id)!.h;
      boxes.set(n.id, { x, y: top + (h - nh) / 2, w, h: nh });
      where.set(n.id, { row: rowIndex, col: -100 - b * 10 - k, colRight: x + w, rowBottom: top + h });
      if (k < ns.length - 1) x += w + pairGap(n.id, ns[k + 1].id);
    });
  };
  let by = pad;
  bandIds.filter((b) => b < 0).forEach((b, k, arr) => { placeBand(b, by, -arr.length + k); by += bandH(b) + RGAP; });
  bandIds.filter((b) => b > 0).forEach((b, k) => { placeBand(b, y, rows.length + k); y += bandH(b) + RGAP; });
  const height = y - RGAP + pad;
  // Nested groups with members: a labelled box around them inside the column.
  for (const g of groups) {
    if (!g.parent) continue;
    const members = spec.nodes.filter((n) => n.parent === g.id).map((n) => boxes.get(n.id)!);
    if (!members.length) continue;
    let x1 = Math.min(...members.map((b) => b.x)) - SUBPAD, y1 = Math.min(...members.map((b) => b.y)) - SUBHEAD;
    let x2 = Math.max(...members.map((b) => b.x + b.w)) + SUBPAD, y2 = Math.max(...members.map((b) => b.y + b.h)) + SUBPAD;
    // Wide enough for its title on one line, centred on its boxes.
    const tw = g.label ? Math.ceil(measure(g.label.toUpperCase(), T.group.size, T.group.weight) * 1.08) + 26 : 0;
    if (tw > x2 - x1) { const c = (x1 + x2) / 2; x1 = c - tw / 2; x2 = c + tw / 2; }
    sceneGroups.push({
      id: g.id, x: x1, y: y1, w: x2 - x1, h: y2 - y1, tone: g.tone ?? 'neutral', parent: g.parent,
      label: g.label ? { lines: wrap(g.label.toUpperCase(), x2 - x1 - 20, T.group.size, T.group.weight).slice(0, 1), size: T.group.size, weight: T.group.weight, lineHeight: T.group.lineHeight, upper: true } : undefined,
    });
  }
  // Nested groups without direct members still exist as ids (for focus): give them
  // their top group's box, but do not draw them.
  const hidden = new Set<string>();
  for (const g of groups) {
    if (!sceneGroups.some((s) => s.id === g.id)) {
      const t = sceneGroups.find((s) => s.id === top(g.id));
      if (t) { sceneGroups.push({ ...t, id: g.id, label: undefined, tone: g.tone ?? t.tone }); hidden.add(g.id); }
    }
  }
  for (const g of sceneGroups) boxes.set(g.id, g);
  const nodes: SceneNode[] = spec.nodes.map((n) => {
    const b = boxes.get(n.id)!, s = sized.get(n.id)!;
    return { id: n.id, ...b, shape: n.shape ?? 'box', parent: n.parent, info: n.info, tone: n.tone ?? 'neutral', tag: s.tag, label: s.label, detail: s.detail, pad: s.pad };
  });
  const laneLabel = new Set<string>();
  // Routes so far. A new route must not run on top of one, nor closer than SEP beside one,
  // nor slide along any box border, its own end boxes included (wires.ts; labels.ts lints it).
  const routed: { from: string; to: string; pts: Pt[] }[] = [];
  const allBoxes = [...boxes.values()];
  const wireCost = (e: { from: string; to: string }, route: Pt[]) => {
    if (degenerate(route) || diagonal(route)) return 1e6;
    let c = grazed(route, allBoxes).length * 3000 + grazed(route, sceneGroups, 4).length * 400;
    for (const r of routed) { const b = between({ ...e, pts: route }, r); c += b.onTop * 5000 + b.close * 2500; }
    return c;
  };
  const edges: SceneEdge[] = spec.edges.map((e, i) => {
    const a = boxes.get(e.from), b = boxes.get(e.to);
    if (!a || !b) throw new Error(`edge ${ids[i]}: unknown endpoint`);
    // Candidate routes; the first that crosses no other box wins (else the fewest crossings).
    const wa = where.get(e.from), wb = where.get(e.to);
    const others = [...boxes.entries()].filter(([id]) => id !== e.from && id !== e.to && spec.nodes.some((n) => n.id === id)).map(([, o]) => o);
    const crossings = (route: Pt[]) => {
      let c = 0;
      for (let k = 1; k < route.length; k++) {
        const [x1, y1] = route[k - 1], [x2, y2] = route[k];
        const lx = Math.min(x1, x2), hx = Math.max(x1, x2), ly = Math.min(y1, y2), hy = Math.max(y1, y2);
        for (const o of others) if (lx < o.x + o.w - 2 && hx > o.x + 2 && ly < o.y + o.h - 2 && hy > o.y + 2) c++;
      }
      return c;
    };
    const cands: { pts: Pt[]; lane?: boolean }[] = [];
    const acy = a.y + a.h / 2, bcy = b.y + b.h / 2;
    if (wa && wb && wa.col !== wb.col) {
      // Side elbow through the gap next to the source column (periscope).
      if (b.x >= a.x + a.w) {
        const xm = Math.min((wa.colRight ?? a.x + a.w) + CGAP / 2, (a.x + a.w + b.x) / 2 + CGAP);
        const gx = b.x > a.x + a.w + 4 ? Math.max(a.x + a.w + 6, Math.min(xm, b.x - 6)) : xm;
        cands.push({ pts: Math.abs(acy - bcy) < 1 ? [[a.x + a.w, acy], [b.x, bcy]] : [[a.x + a.w, acy], [gx, acy], [gx, bcy], [b.x, bcy]] });
      } else if (b.x + b.w <= a.x) {
        const gx = Math.max(b.x + b.w + 6, Math.min(a.x - CGAP / 2, a.x - 6));
        cands.push({ pts: Math.abs(acy - bcy) < 1 ? [[a.x, acy], [b.x + b.w, bcy]] : [[a.x, acy], [gx, acy], [gx, bcy], [b.x + b.w, bcy]] });
      }
      // Lane in the free band above/below the target, entering from the top/bottom.
      if (wa.row === wb.row && (b.y >= a.y + a.h || a.y >= b.y + b.h)) {
        const dir = b.x > a.x ? 1 : -1;
        const sx = a.x + a.w / 2 + dir * Math.min(18, a.w / 4), tx = b.x + b.w / 2 - dir * Math.min(18, b.w / 4);
        const x1 = Math.min(sx, tx), x2 = Math.max(sx, tx);
        const across = others.concat([a, b]).filter((o) => o.x < x2 && o.x + o.w > x1);
        if (b.y >= a.y + a.h) {
          const above = Math.max(a.y + a.h, ...across.filter((o) => o.y + o.h <= b.y + 1).map((o) => o.y + o.h));
          const below = Math.min(b.y, ...across.filter((o) => o.y >= a.y + a.h - 1).map((o) => o.y));
          // Turn so the arrowhead run is full length, keeping the first run long enough.
          const ly = below - above >= T.minSeg + T.minLast + 4 ? below - T.minLast - 2 : (above + below) / 2;
          cands.push({ pts: [[sx, a.y + a.h], [sx, ly], [tx, ly], [tx, b.y]] });
        } else {
          const above = Math.max(b.y + b.h, ...across.filter((o) => o.y + o.h <= a.y + 1).map((o) => o.y + o.h));
          const below = Math.min(a.y, ...across.filter((o) => o.y >= b.y + b.h - 1).map((o) => o.y));
          const ly = below - above >= T.minSeg + T.minLast + 4 ? above + T.minLast + 2 : (above + below) / 2;
          cands.push({ pts: [[sx, a.y], [sx, ly], [tx, ly], [tx, b.y + b.h]] });
        }
      }
    }
    if (wa && wb && wa.col !== wb.col) {
      // Enter b through the gap just above (or below) it, from a's facing side;
      // or leave a through the gap just below (or above) it into b's facing side.
      const within = (v: number, o: Box) => v > o.y + 4 && v < o.y + o.h - 4;
      const bx = b.x + b.w / 2, ax = a.x + a.w / 2;
      const aSide = b.x >= a.x + a.w ? a.x + a.w : b.x + b.w <= a.x ? a.x : undefined;
      const bSide = b.x >= a.x + a.w ? b.x : b.x + b.w <= a.x ? b.x + b.w : undefined;
      if (aSide !== undefined) {
        for (const ly of [b.y - T.minLast - 2, b.y + b.h + T.minLast + 2]) if (within(ly, a)) cands.push({ pts: [[aSide, ly], [bx, ly], [bx, ly < b.y ? b.y : b.y + b.h]] });
      }
      if (bSide !== undefined) {
        for (const ly of [a.y + a.h + T.minSeg + 4, a.y - T.minSeg - 4]) if (within(ly, b)) cands.push({ pts: [[ax, ly > a.y ? a.y + a.h : a.y], [ax, ly], [bSide, ly]] });
      }
    }
    if (wa && wb && wa.col === wb.col) {
      // Same column: straight, or a side lane when boxes sit in between. The lane
      // clears every box between the two ends (they may be wider, e.g. pills), and
      // its side runs are long enough for the lint, so it beats crossing a box.
      const y1 = Math.min(a.y + a.h, b.y + b.h), y2 = Math.max(a.y, b.y);
      const between = others.filter((o) => o.y < y2 && o.y + o.h > y1 && o.x < Math.max(a.x + a.w, b.x + b.w) && o.x + o.w > Math.min(a.x, b.x));
      const right = Math.max(a.x + a.w, b.x + b.w, ...between.map((o) => o.x + o.w));
      const ay = acy + (b.y > a.y ? 6 : -6), by = bcy + (b.y > a.y ? -6 : 6);
      cands.push({ pts: orthogonal(a, b, wa, wb, CGAP, RGAP) });
      for (const out of [T.minLast + 4, T.minLast + 14]) {
        const lane = right + out;
        cands.push({ pts: [[a.x + a.w, ay], [lane, ay], [lane, by], [b.x + b.w, by]], lane: true });
      }
    }
    cands.push({ pts: orthogonal(a, b, wa, wb, CGAP, RGAP) });
    // Hard: crossing boxes. Soft: passing through other groups, length, bends.
    const ownGroups = new Set([top(spec.nodes.find((n) => n.id === e.from)?.parent), top(spec.nodes.find((n) => n.id === e.to)?.parent)]);
    const groupBoxes = sceneGroups.filter((g) => !ownGroups.has(g.id) && !g.parent);
    const cost = (route: Pt[]) => {
      let len = 0, soft = 0;
      for (let k = 1; k < route.length; k++) {
        const [x1, y1] = route[k - 1], [x2, y2] = route[k];
        len += Math.abs(x2 - x1) + Math.abs(y2 - y1);
        const lx = Math.min(x1, x2), hx = Math.max(x1, x2), ly = Math.min(y1, y2), hy = Math.max(y1, y2);
        for (const g of groupBoxes) if (lx < g.x + g.w - 2 && hx > g.x + 2 && ly < g.y + g.h - 2 && hy > g.y + 2) soft++;
      }
      return crossings(route) * 10000 + shortRuns(route) * 5000 + wireCost(e, route) + soft * 300 + len + (route.length - 2) * 40;
    };
    // Near-straight elbows become straight lines when the boxes overlap vertically/horizontally.
    for (const c of [...cands]) {
      const st = straighten(a, b, c.pts);
      if (st) cands.push({ pts: st });
    }
    // Each inner run also shifted sideways a little, so parallel wires can spread apart.
    for (const c of [...cands]) {
      for (let k = 1; k + 2 < c.pts.length; k++) {
        const [p, q] = [c.pts[k], c.pts[k + 1]];
        const v = Math.abs(p[0] - q[0]) < 0.5, h = Math.abs(p[1] - q[1]) < 0.5;
        if (!v && !h) continue;
        for (const d of [-16, -8, 8, 16]) {
          const pts = c.pts.map((x) => [...x] as Pt);
          if (v) { pts[k][0] += d; pts[k + 1][0] += d; } else { pts[k][1] += d; pts[k + 1][1] += d; }
          cands.push({ pts, lane: c.lane });
        }
      }
    }
    // Ports: the first and last runs may also slide along their box side (so wires into one
    // side spread out), or line up exactly with a wire already at that side (a shared trunk).
    for (const c of [...cands]) {
      const n = c.pts.length;
      if (n < 3) continue;
      const end = (first: boolean) => {
        const [p0, p1] = first ? [c.pts[0], c.pts[1]] : [c.pts[n - 1], c.pts[n - 2]];
        const box = first ? a : b;
        const h = Math.abs(p0[1] - p1[1]) < 0.5;
        const lo = h ? box.y + 8 : box.x + 8, hi = h ? box.y + box.h - 8 : box.x + box.w - 8;
        const at = h ? p0[1] : p0[0];
        const offers = [at - 20, at - 10, at + 10, at + 20];
        for (const r of routed) {
          if ((first ? r.from !== e.from : r.to !== e.to) || r.pts.length < 2) continue;
          const [q0, q1] = first ? [r.pts[0], r.pts[1]] : [r.pts[r.pts.length - 1], r.pts[r.pts.length - 2]];
          const rh = Math.abs(q0[1] - q1[1]) < 0.5;
          if (rh === h && Math.abs((h ? q0[0] : q0[1]) - (h ? p0[0] : p0[1])) < 0.5) offers.push(h ? q0[1] : q0[0]);
        }
        for (const v of offers) {
          if (v < lo || v > hi) continue;
          const pts = c.pts.map((x) => [...x] as Pt);
          const [i0, i1] = first ? [0, 1] : [n - 1, n - 2];
          if (h) { pts[i0][1] = v; pts[i1][1] = v; } else { pts[i0][0] = v; pts[i1][0] = v; }
          cands.push({ pts, lane: c.lane });
        }
      };
      end(true);
      end(false);
    }
    for (const c of cands) c.pts = simplify(c.pts);
    const scored = cands.map((c, k) => ({ ...c, n: cost(c.pts), k }));
    const chosen = scored.reduce((best, c) => (c.n < best.n ? c : best));
    const pts = chosen.pts;
    routed.push({ from: e.from, to: e.to, pts });
    if (chosen.lane) laneLabel.add(ids[i]);
    const l = e.label ? labelOf(e.label) : undefined;
    const mid = midpoint(pts);
    // Side-lane edges: the label sits just outside the lane, clear of the boxes.
    if (l && laneLabel.has(ids[i])) mid[0] = pts[1][0] + l.w / 2 + 4;
    return {
      id: ids[i], from: e.from, to: e.to, points: pts, tone: e.tone ?? 'neutral', dashed: e.style === 'dashed', info: e.info,
      arrowEnd: (e.arrow ?? 'end') !== 'none', arrowStart: e.arrow === 'both',
      label: l ? { x: mid[0], y: mid[1], w: l.w, h: l.h, text: l.text } : undefined,
    };
  });
  return {
    cols: cols.length,
    info: cols.map((c) => ({ canRow: c.nodes.length > 1 && !hasSubs(c), dir: c.group?.direction })),
    scene: { kind: 'graph', width: Math.ceil(width), height: Math.ceil(height), groups: sceneGroups.filter((g) => !hidden.has(g.id)), nodes, edges, lifelines: [] },
  };
}

type Box = { x: number; y: number; w: number; h: number };
type Where = { row: number; col: number; colRight: number; rowBottom: number };
/** Orthogonal route between two boxes using their row/column placement. */
function orthogonal(a: Box, b: Box, wa: Where | undefined, wb: Where | undefined, cgap: number, rgap: number): Pt[] {
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  // Different rows and one box spans the other's centre (e.g. a full-width band):
  // a straight vertical at the narrower box's centre.
  if (wa && wb && wa.row !== wb.row) {
    const narrow = a.w <= b.w ? acx : bcx;
    if (narrow > Math.max(a.x, b.x) + 4 && narrow < Math.min(a.x + a.w, b.x + b.w) - 4) {
      return bcy > acy ? [[narrow, a.y + a.h], [narrow, b.y]] : [[narrow, a.y], [narrow, b.y + b.h]];
    }
  }
  if (wa && wb && wa.col === wb.col) {
    return bcy > acy ? [[acx, a.y + a.h], [acx, b.y]] : [[acx + 12, a.y], [acx + 12, b.y + b.h]];
  }
  if (!wa || !wb || wa.row === wb.row) {
    // Same row: out of the facing side, turn in the gap next to the source column.
    if (bcx > acx) {
      const xm = (wa?.colRight ?? a.x + a.w) + cgap / 2;
      return Math.abs(acy - bcy) < 1 ? [[a.x + a.w, acy], [b.x, bcy]] : [[a.x + a.w, acy], [xm, acy], [xm, bcy], [b.x, bcy]];
    }
    const xm = a.x - cgap / 2;
    return [[a.x, acy], [xm, acy], [xm, bcy], [b.x + b.w, bcy]];
  }
  if (wb.row > wa.row) {
    // Later row: out of the bottom of the source's column, across the row gap, into the target's top.
    const ym = wa.rowBottom + rgap / 2;
    return [[acx, a.y + a.h], [acx, ym], [bcx, ym], [bcx, b.y]];
  }
  // Earlier row (e.g. a band above): turn in the gap below the target, not above it
  // (above it the route left the scene and ran back through the target box).
  const ym = (b.y + b.h + a.y) / 2;
  return [[acx, a.y], [acx, ym], [bcx, ym], [bcx, b.y + b.h]];
}

/** Drop repeated points and collinear middles. */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.5 && Math.abs(last[1] - p[1]) < 0.5) continue;
    out.push([p[0], p[1]]);
    while (out.length >= 3) {
      const [p0, p1, p2] = out.slice(-3);
      const collinear = (Math.abs(p0[0] - p1[0]) < 0.5 && Math.abs(p1[0] - p2[0]) < 0.5) || (Math.abs(p0[1] - p1[1]) < 0.5 && Math.abs(p1[1] - p2[1]) < 0.5);
      if (!collinear) break;
      out.splice(out.length - 2, 1);
    }
  }
  return out;
}

/** Runs shorter than the lint minimum (the last run, with the arrowhead, needs more). */
export function shortRuns(pts: Pt[]): number {
  let n = 0;
  for (let k = 1; k < pts.length; k++) {
    const len = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    if (len < (k === pts.length - 1 ? T.minLast : T.minSeg)) n++;
  }
  return n;
}

/** A straight replacement for a route whose ends can line up (shared x or y range). */
function straighten(a: Box, b: Box, pts: Pt[]): Pt[] | undefined {
  if (pts.length < 3) return undefined;
  const oy1 = Math.max(a.y, b.y) + 6, oy2 = Math.min(a.y + a.h, b.y + b.h) - 6;
  if (oy2 >= oy1 && (b.x >= a.x + a.w || a.x >= b.x + b.w)) {
    const y = (oy1 + oy2) / 2;
    return b.x >= a.x + a.w ? [[a.x + a.w, y], [b.x, y]] : [[a.x, y], [b.x + b.w, y]];
  }
  const ox1 = Math.max(a.x, b.x) + 6, ox2 = Math.min(a.x + a.w, b.x + b.w) - 6;
  if (ox2 >= ox1 && (b.y >= a.y + a.h || a.y >= b.y + b.h)) {
    const x = (ox1 + ox2) / 2;
    return b.y >= a.y + a.h ? [[x, a.y + a.h], [x, b.y]] : [[x, a.y], [x, b.y + b.h]];
  }
  return undefined;
}

function midpoint(pts: Pt[]): Pt {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let t = segs.reduce((s, x) => s + x, 0) / 2;
  for (let i = 0; i < segs.length; i++) {
    if (t <= segs[i]) {
      const f = segs[i] ? t / segs[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    t -= segs[i];
  }
  return pts[pts.length - 1];
}
