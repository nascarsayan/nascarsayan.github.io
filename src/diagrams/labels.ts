/**
 * Edge-label placement, run on every laid-out scene. Labels are drawn above
 * boxes (render.ts), so a label sitting on a box would hide its text. Each
 * label that overlaps a box or an earlier label slides along its own edge to
 * the nearest clear spot; failing that, it may step off the line a little.
 * Labels also keep clear of other edges' lines (a label on a wire hides where it
 * goes), of every arrowhead (its own included) and of junctions/bends of other
 * edges. Whatever still overlaps is reported so the build can warn about it.
 */
import type { Pt, Scene } from './scene';
import { between, degenerate, diagonal, grazed, GRAZE, SEP } from './wires';

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 4;      // clearance kept around boxes and labels
const STEP = 4;     // sampling step along the edge (px)
const END = 14;     // stay this far from the edge's ends (arrowheads, box borders)

const overlap = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const grow = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

/** Points every STEP px along a polyline, with the run direction at each. */
function samples(pts: Pt[]): { p: Pt; horiz: boolean }[] {
  const out: { p: Pt; horiz: boolean }[] = [];
  const total = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const horiz = Math.abs(y2 - y1) < Math.abs(x2 - x1);
    for (let d = 0; d <= len; d += STEP) {
      const at = walked + d;
      if (at < END || at > total - END) continue;
      out.push({ p: [x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len], horiz });
    }
    walked += len;
  }
  return out;
}

export interface LabelOverlap { edge: string; with: string }

/** Thin rects for an edge's runs (WIRE px either side), its arrowhead and its corners. */
const WIRE = 2, HEAD = 10, CORNER = 5;
type Wire = { id: string; from: string; runs: { a: Pt; b: Pt; r: Rect }[]; heads: Rect[]; corners: Rect[] };
const runRect = (a: Pt, b: Pt): Rect => ({ x: Math.min(a[0], b[0]) - WIRE, y: Math.min(a[1], b[1]) - WIRE, w: Math.abs(a[0] - b[0]) + 2 * WIRE, h: Math.abs(a[1] - b[1]) + 2 * WIRE });
const around = (p: Pt, r: number): Rect => ({ x: p[0] - r, y: p[1] - r, w: 2 * r, h: 2 * r });
function wiresOf(scene: Scene): Wire[] {
  return scene.edges.map((e) => {
    const pts = e.points;
    const heads = [...(e.arrowEnd !== false ? [around(pts[pts.length - 1], HEAD)] : []), ...(e.arrowStart ? [around(pts[0], HEAD)] : [])];
    return { id: e.id, from: e.from, runs: pts.slice(1).map((b, k) => ({ a: pts[k], b, r: runRect(pts[k], b) })), heads, corners: pts.slice(1, -1).map((q) => around(q, CORNER)) };
  });
}
/** A run of another edge that lies on one of this edge's runs (a shared trunk of a fan-out). */
function onOwn(run: { a: Pt; b: Pt }, own: Wire): boolean {
  return own.runs.some((o) => {
    const h = run.a[1] === run.b[1] && o.a[1] === o.b[1] && Math.abs(run.a[1] - o.a[1]) < 1;
    const v = run.a[0] === run.b[0] && o.a[0] === o.b[0] && Math.abs(run.a[0] - o.a[0]) < 1;
    if (h) return Math.min(Math.max(run.a[0], run.b[0]), Math.max(o.a[0], o.b[0])) - Math.max(Math.min(run.a[0], run.b[0]), Math.min(o.a[0], o.b[0])) > 1;
    if (v) return Math.min(Math.max(run.a[1], run.b[1]), Math.max(o.a[1], o.b[1])) - Math.max(Math.min(run.a[1], run.b[1]), Math.min(o.a[1], o.b[1])) > 1;
    return false;
  });
}
/** What a label rect at r would hide of the other edges: [cost, what]. */
function hides(r: Rect, own: Wire, wires: Wire[]): { cost: number; what: string[] } {
  let cost = 0;
  const what: string[] = [];
  for (const w of wires) {
    const self = w.id === own.id;
    for (const h of w.heads) { const o = overlap(r, h); if (o > 0) { cost += o + 400; what.push(self ? 'its own arrowhead' : `arrowhead of ${w.id}`); } }
    if (self) continue;
    for (const run of w.runs) {
      if (w.from === own.from && onOwn(run, own)) continue;
      const o = overlap(r, run.r);
      if (o > 0) { cost += o + 200; what.push(`edge ${w.id}`); }
    }
    for (const c of w.corners) { const o = overlap(r, c); if (o > 0) { cost += o + 200; what.push(`a bend of ${w.id}`); } }
  }
  return { cost, what: [...new Set(what)] };
}

export function placeLabels(scene: Scene): { scene: Scene; overlaps: LabelOverlap[] } {
  const boxes = scene.nodes.map((n) => ({ id: n.id, r: grow({ x: n.x, y: n.y, w: n.w, h: n.h }, PAD) }));
  const placed: { id: string; r: Rect }[] = [];
  const overlaps: LabelOverlap[] = [];
  const wires = wiresOf(scene);
  const edges = scene.edges.map((e, ei) => {
    if (!e.label) return e;
    const own = wires[ei];
    const { w, h } = e.label;
    const at = (c: Pt): Rect => ({ x: c[0] - w / 2, y: c[1] - h / 2, w, h });
    const cost = (r: Rect) => {
      let c = 0;
      for (const b of boxes) c += overlap(r, b.r);
      for (const l of placed) c += overlap(r, grow(l.r, PAD));
      return c + hides(r, own, wires).cost;
    };
    const home: Pt = [e.label.x, e.label.y];
    let best = { c: home, cost: cost(at(home)), dist: 0 };
    if (best.cost > 0) {
      for (const s of samples(e.points)) {
        // On the line first; then just beside it (above/below a horizontal run, left/right of a vertical one).
        const off = s.horiz ? [[0, 0], [0, -(h / 2 + 6)], [0, h / 2 + 6]] : [[0, 0], [-(w / 2 + 6), 0], [w / 2 + 6, 0]];
        off.forEach(([dx, dy], k) => {
          const c: Pt = [s.p[0] + dx, s.p[1] + dy];
          const cs = cost(at(c));
          // Prefer clear spots, then on-line spots, then the nearest to the original.
          const dist = Math.hypot(c[0] - home[0], c[1] - home[1]) + (k ? 60 : 0);
          if (cs < best.cost - 0.5 || (Math.abs(cs - best.cost) <= 0.5 && dist < best.dist)) best = { c, cost: cs, dist };
        });
      }
    }
    const r = at(best.c);
    for (const b of boxes) if (overlap(r, b.r) > 0) overlaps.push({ edge: e.id, with: b.id });
    for (const l of placed) if (overlap(r, grow(l.r, PAD)) > 0) overlaps.push({ edge: e.id, with: `label ${l.id}` });
    for (const w of hides(r, own, wires).what) overlaps.push({ edge: e.id, with: w });
    placed.push({ id: e.id, r });
    return { ...e, label: { ...e.label, x: best.c[0], y: best.c[1] } };
  });
  return { scene: { ...scene, edges }, overlaps };
}

/** Lint messages: edges through boxes that are not their ends, and the label overlaps left by placeLabels. */
export function collisions(scene: Scene, labelOverlaps: LabelOverlap[]): string[] {
  const out: string[] = [];
  for (const e of scene.edges) {
    if (e.points.some(([x, y]) => x < 0 || y < 0 || x > scene.width || y > scene.height)) out.push(`edge ${e.id} leaves the diagram (clipped)`);
    for (let k = 1; k < e.points.length; k++) {
      const [x1, y1] = e.points[k - 1], [x2, y2] = e.points[k];
      const lx = Math.min(x1, x2), hx = Math.max(x1, x2), ly = Math.min(y1, y2), hy = Math.max(y1, y2);
      for (const n of scene.nodes) {
        if (n.id === e.from || n.id === e.to) continue;
        if (lx < n.x + n.w - 2 && hx > n.x + 2 && ly < n.y + n.h - 2 && hy > n.y + 2) out.push(`edge ${e.id} runs through box ${n.id}`);
      }
    }
  }
  // Two wires on top of each other read as one: what goes where is lost. Wires that leave or
  // reach the same port may share a trunk (junction dots mark the split; render.ts).
  // Wire rules (wires.ts): no line at all, sliding along a box border, two wires on one line,
  // two parallel wires too close. Sequence messages are exempt (parallel by design).
  if (scene.kind === 'graph') {
    for (const e of scene.edges) {
      if (degenerate(e.points)) { out.push(`edge ${e.id} has no length (not drawn)`); continue; }
      if (diagonal(e.points)) out.push(`edge ${e.id} has a slanted run (wires are horizontal and vertical only)`);
      for (const b of grazed(e.points, scene.nodes)) out.push(`edge ${e.id} runs along the border of box ${b.id} (keep ${GRAZE}px away, or meet it head on)`);
    }
    const wires = scene.edges.map((e) => ({ from: e.from, to: e.to, pts: e.points }));
    for (let i = 0; i < wires.length; i++) for (let j = i + 1; j < wires.length; j++) {
      const b = between(wires[i], wires[j]);
      if (b.onTop) out.push(`edges ${scene.edges[i].id} and ${scene.edges[j].id} run on top of each other`);
      if (b.close) out.push(`edges ${scene.edges[i].id} and ${scene.edges[j].id} run side by side closer than ${SEP}px`);
    }
  }
  for (const o of labelOverlaps) out.push(`label of ${o.edge} covers ${/^(label|edge|arrowhead|its own|a bend) /.test(o.with) ? o.with : `box ${o.with}`}`);
  return [...new Set(out)];
}

/** How many collisions a scene would have once its labels are placed (for choosing layouts). */
export const collisionCount = (scene: Scene) => {
  const { scene: placed, overlaps } = placeLabels(scene);
  return collisions(placed, overlaps).length;
};
