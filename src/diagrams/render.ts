/** Scene -> SVG markup. Colours come from CSS (tone classes); see diagram.css. */
import { T, type Pt, type Scene, type SceneEdge, type SceneGroup, type SceneNode, type TextBlock } from './scene';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const n = (v: number) => Math.round(v * 10) / 10;

function lines(b: TextBlock, cx: number, top: number, cls: string, anchor: 'middle' | 'start' = 'middle'): string {
  return b.lines
    .map((l, i) => `<text class="${cls}" x="${n(cx)}" y="${n(top + i * b.lineHeight + b.lineHeight / 2)}" text-anchor="${anchor}" dominant-baseline="central">${esc(b.upper ? l.toUpperCase() : l)}</text>`)
    .join('');
}

function nodeShape(nd: SceneNode): string {
  const { x, y, w, h } = nd;
  switch (nd.shape) {
    case 'store': {
      const ry = 8;
      return `<path class="dg-shape" d="M${n(x)} ${n(y + ry)} a${n(w / 2)} ${ry} 0 0 1 ${n(w)} 0 v${n(h - 2 * ry)} a${n(w / 2)} ${ry} 0 0 1 ${n(-w)} 0 z"/>` +
        `<path class="dg-shape-line" d="M${n(x)} ${n(y + ry)} a${n(w / 2)} ${ry} 0 0 0 ${n(w)} 0"/>`;
    }
    case 'note': {
      const c = 12;
      return `<path class="dg-shape" d="M${n(x)} ${n(y)} h${n(w - c)} l${c} ${c} v${n(h - c)} h${n(-w)} z"/><path class="dg-shape-line" d="M${n(x + w - c)} ${n(y)} v${c} h${c}"/>`;
    }
    case 'pill':
      return `<rect class="dg-shape" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}"/>`;
    case 'external':
      return `<rect class="dg-shape dg-external" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="10"/>`;
    default:
      return `<rect class="dg-shape" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="10"/>`;
  }
}

/** Intro delay per element id (ms), computed in renderScene. */
type Delays = Map<string, number>;
const delayStyle = (delays: Delays, id: string) => `--d:${Math.round(delays.get(id) ?? 0)}ms`;

/** A box's text lines (tag, label, detail), centred in the box. Also used for Step text swaps. */
export function nodeText(nd: SceneNode): string {
  const blocks = [nd.tag, nd.label, nd.detail].filter(Boolean) as TextBlock[];
  const contentH = blocks.reduce((s, b) => s + b.lines.length * b.lineHeight, 0) + (blocks.length - 1) * T.gap;
  const storeShift = nd.shape === 'store' ? 8 : 0;
  let top = nd.y + storeShift + (nd.h - storeShift - contentH) / 2;
  const cx = nd.x + nd.w / 2;
  let text = '';
  for (const [b, cls] of [[nd.tag, 'dg-tag'], [nd.label, 'dg-label'], [nd.detail, 'dg-detail']] as const) {
    if (!b) continue;
    text += lines(b, cx, top, cls);
    top += b.lines.length * b.lineHeight + T.gap;
  }
  return text;
}

/**
 * A box that opens into its own inside diagram (<Drilldown>): a magnifier badge on the
 * top-right corner, half outside the box (the scene's 12px margin keeps it in view),
 * so it never covers the box's text. Drilldown's script toggles aria-expanded.
 */
function badge(nd: SceneNode): string {
  const cx = n(nd.x + nd.w - 3), cy = n(nd.y + 3);
  return `<g class="dg-badge" aria-hidden="true"><circle class="dg-badge-bg" cx="${cx}" cy="${cy}" r="9"/>` +
    `<circle class="dg-badge-ic" cx="${n(cx - 1.2)}" cy="${n(cy - 1.2)}" r="3.6"/><path class="dg-badge-ic" d="M${n(cx + 1.4)} ${n(cy + 1.4)} l3 3"/></g>`;
}

/**
 * A box with `info`: an "i" button on its top-left corner. Clicking it shows the box's card
 * (scripts/diagram-player.ts); the box itself does nothing else.
 */
function infoButton(nd: SceneNode, name: string): string {
  const cx = n(nd.x + 3), cy = n(nd.y + 3);
  return `<g class="dg-info-btn" role="button" tabindex="0" aria-expanded="false" aria-label="${esc(`About ${name}`)}"><circle class="dg-info-bg" cx="${cx}" cy="${cy}" r="9"/>` +
    `<circle class="dg-info-dot" cx="${cx}" cy="${n(nd.y - 0.6)}" r="1.25"/><path class="dg-info-ic" d="M${cx} ${n(nd.y + 2.4)}v5"/></g>`;
}

function node(nd: SceneNode, delays: Delays, open?: Set<string>): string {
  const text = nodeText(nd);
  const opens = open?.has(nd.id);
  const name = nd.label.lines.join(' ');
  const a11y = opens ? ` tabindex="0" role="button" aria-expanded="false" aria-label="${esc(`${name}: show what is inside`)}"` : '';
  return `<g class="dg-node tone-${nd.tone}${opens ? ' dg-opens' : ''}" style="${delayStyle(delays, nd.id)}" data-el="${esc(nd.id)}" data-kind="node"${nd.parent ? ` data-parent="${esc(nd.parent)}"` : ''}${nd.info ? ` data-info="${esc(nd.info)}"` : ''}${a11y}>${nd.info ? `<desc>${esc(nd.info)}</desc>` : ''}${nodeShape(nd)}${text}${opens ? badge(nd) : ''}${nd.info ? infoButton(nd, name) : ''}</g>`;
}

function group(g: SceneGroup, delays: Delays): string {
  const label = g.label ? lines(g.label, g.x + 14, g.y + 8, 'dg-group-label', 'start') : '';
  return `<g class="dg-group tone-${g.tone}" style="${delayStyle(delays, g.id)}" data-el="${esc(g.id)}" data-kind="group"${g.parent ? ` data-parent="${esc(g.parent)}"` : ''}><rect class="dg-group-box" x="${n(g.x)}" y="${n(g.y)}" width="${n(g.w)}" height="${n(g.h)}" rx="14"/>${label}</g>`;
}

/** Radius of the half-circle where a horizontal wire hops over a vertical one. */
const HOP = 4.5;

/**
 * Polyline with rounded corners. `hops[k]`: x positions where run k (horizontal) crosses a
 * vertical wire of another edge; the run jumps over each with a small half circle, the
 * old schematic way of saying "these two do not connect".
 */
function rounded(pts: Pt[], r = 10, hops: number[][] = []): string {
  if (pts.length < 2) return '';
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  let from: Pt = pts[0];
  const run = (k: number, to: Pt) => {
    const dir = Math.sign(to[0] - from[0]);
    // One jump per crossing point: wires that share a trunk (same x) are crossed once, and
    // jumps that would touch are merged (a second jump would draw a line back under the first).
    const xs = (hops[k] ?? []).filter((x) => dir && (x - from[0]) * dir > HOP + 2 && (to[0] - x) * dir > HOP + 2).sort((a, b) => (a - b) * dir)
      .filter((x, i, all) => i === 0 || Math.abs(x - all[i - 1]) > 2 * HOP + 2);
    for (const x of xs) d += ` L${n(x - dir * HOP)} ${n(to[1])} A${HOP} ${HOP} 0 0 ${dir > 0 ? 1 : 0} ${n(x + dir * HOP)} ${n(to[1])}`;
    d += ` L${n(to[0])} ${n(to[1])}`;
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * rr, ay = cy - ((cy - py) / l1) * rr;
    const bx = cx + ((nx - cx) / l2) * rr, by = cy + ((ny - cy) / l2) * rr;
    run(i - 1, [ax, ay]);
    d += ` Q${n(cx)} ${n(cy)} ${n(bx)} ${n(by)}`;
    from = [bx, by];
  }
  run(pts.length - 2, pts[pts.length - 1]);
  return d;
}

const horiz = (a: Pt, b: Pt) => Math.abs(a[1] - b[1]) < 0.5 && Math.abs(a[0] - b[0]) > 0.5;
const vert = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) > 0.5;

/** Where each edge's horizontal runs cross another edge's vertical runs (edges from one box share a net: no hop). */
function crossings(edges: SceneEdge[]): Map<string, number[][]> {
  const out = new Map<string, number[][]>();
  const M = 16, MV = 6; // clear of the corners on the hopping run, of the ends on the crossed one
  for (const e of edges) {
    const hops: number[][] = [];
    e.points.slice(1).forEach((b, k) => {
      const a = e.points[k];
      if (!horiz(a, b)) return;
      const lo = Math.min(a[0], b[0]) + M, hi = Math.max(a[0], b[0]) - M, y = a[1];
      for (const o of edges) {
        if (o === e || o.from === e.from) continue;
        o.points.slice(1).forEach((q, j) => {
          const p = o.points[j];
          if (!vert(p, q)) return;
          const x = p[0];
          if (x > lo && x < hi && y > Math.min(p[1], q[1]) + MV && y < Math.max(p[1], q[1]) - MV) (hops[k] ??= []).push(x);
        });
      }
    });
    if (hops.length) out.set(e.id, hops);
  }
  return out;
}

/**
 * Junction dots: where wires that leave the same port (or arrive at the same port) part
 * ways, a dot marks the split, so a branch reads as connected and a crossing (a hop) as not.
 */
function junctions(edges: SceneEdge[]): { at: Pt; tone: string; ids: string[] }[] {
  const eq = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5;
  const dots = new Map<string, { at: Pt; tone: string; ids: Set<string> }>();
  const split = (P: Pt[], Q: Pt[]): Pt | null => {
    let i = 1;
    while (i < P.length && i < Q.length && eq(P[i], Q[i])) i++;
    if (i >= P.length || i >= Q.length) return null;
    const c = P[i - 1];
    const dp = [Math.sign(P[i][0] - c[0]), Math.sign(P[i][1] - c[1])], dq = [Math.sign(Q[i][0] - c[0]), Math.sign(Q[i][1] - c[1])];
    let at = c;
    if (dp[0] === dq[0] && dp[1] === dq[1]) at = Math.hypot(P[i][0] - c[0], P[i][1] - c[1]) < Math.hypot(Q[i][0] - c[0], Q[i][1] - c[1]) ? P[i] : Q[i];
    return eq(at, P[0]) ? null : at;
  };
  const add = (group: Map<string, { e: SceneEdge; pts: Pt[] }[]>) => {
    for (const list of group.values()) {
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
        const at = split(list[a].pts, list[b].pts);
        if (!at) continue;
        const key = `${n(at[0])},${n(at[1])}`;
        const dot = dots.get(key) ?? { at, tone: list[a].e.tone, ids: new Set<string>() };
        dot.ids.add(list[a].e.id); dot.ids.add(list[b].e.id);
        dots.set(key, dot);
      }
    }
  };
  const by = (end: 'from' | 'to') => {
    const m = new Map<string, { e: SceneEdge; pts: Pt[] }[]>();
    for (const e of edges) {
      if (e.points.length < 3 || e.self) continue;
      const pts = end === 'from' ? e.points : [...e.points].reverse();
      const key = `${e[end]}|${n(pts[0][0])},${n(pts[0][1])}`;
      m.set(key, [...(m.get(key) ?? []), { e, pts }]);
    }
    return m;
  };
  add(by('from'));
  add(by('to'));
  return [...dots.values()].map((d) => ({ at: d.at, tone: d.tone, ids: [...d.ids] }));
}

const AL = 9, AW = 4.5;
function shorten(pts: Pt[], atEnd: boolean): Pt[] {
  const p = pts.map((q) => [...q] as Pt);
  const [a, b] = atEnd ? [p[p.length - 2], p[p.length - 1]] : [p[1], p[0]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len > AL) { b[0] -= ((b[0] - a[0]) / len) * (AL - 1); b[1] -= ((b[1] - a[1]) / len) * (AL - 1); }
  return p;
}
function arrow(tip: Pt, from: Pt): string {
  const len = Math.hypot(tip[0] - from[0], tip[1] - from[1]) || 1;
  const ux = (tip[0] - from[0]) / len, uy = (tip[1] - from[1]) / len;
  const bx = tip[0] - ux * AL, by = tip[1] - uy * AL;
  return `<path class="dg-arrow" d="M${n(tip[0])} ${n(tip[1])} L${n(bx - uy * AW)} ${n(by + ux * AW)} L${n(bx + uy * AW)} ${n(by - ux * AW)} z"/>`;
}

/** An edge's line, plus its label drawn separately so labels sit above every line and box. */
function edge(e: SceneEdge, delays: Delays, hops: number[][] = []): { line: string; label: string } {
  if (e.points.length < 2) return { line: '', label: '' };
  let pts = e.points;
  if (e.arrowEnd) pts = shorten(pts, true);
  if (e.arrowStart) pts = shorten(pts, false);
  const d = rounded(pts, e.self ? 8 : 10, hops);
  const heads = (e.arrowEnd ? arrow(e.points[e.points.length - 1], e.points[e.points.length - 2]) : '') + (e.arrowStart ? arrow(e.points[0], e.points[1]) : '');
  const length = e.points.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - e.points[i][0], p[1] - e.points[i][1]), 0);
  const dur = Math.max(0.9, Math.min(3, length / 220));
  // No packet in the markup: hundreds of always-running SMIL loops cost every frame.
  // The player adds one only to the edges a step lights (data-dur is its loop time).
  const label = e.label
    ? `<rect class="dg-edge-label-bg" x="${n(e.label.x - e.label.w / 2)}" y="${n(e.label.y - e.label.h / 2)}" width="${n(e.label.w)}" height="${n(e.label.h)}" rx="6"/>` +
      lines(e.label.text, e.label.x, e.label.y - (e.label.text.lines.length * e.label.text.lineHeight) / 2, 'dg-edge-label')
    : '';
  const len = pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0) + 20;
  return {
    line: `<g class="dg-edge tone-${e.tone}${e.dashed ? ' is-dashed' : ''}" style="${delayStyle(delays, e.id)};--len:${Math.ceil(len)}" data-el="${esc(e.id)}" data-kind="edge"${e.info ? ` data-info="${esc(e.info)}"` : ''} data-from="${esc(e.from)}" data-to="${esc(e.to)}" data-dur="${n(dur)}"><path class="dg-hit" d="${d}"/><path class="dg-line" d="${d}"/>${heads}</g>`,
    label: label ? `<g class="dg-elabel tone-${e.tone}" style="${delayStyle(delays, e.id)}" data-el="${esc(e.id)}" data-kind="label"${e.info ? ` data-info="${esc(e.info)}"` : ''}>${label}</g>` : '',
  };
}

/** Intro choreography: groups, then nodes in reading order, then each edge once both ends are in. */
function delays(s: Scene): Delays {
  const out: Delays = new Map();
  [...s.groups].sort((a, b) => a.y - b.y || a.x - b.x).forEach((g, i) => out.set(g.id, i * 60));
  const order = [...s.nodes].sort((a, b) => (s.kind === 'sequence' ? a.x - b.x : Math.round(a.y / 60) - Math.round(b.y / 60) || a.x - b.x));
  const step = Math.min(70, 1100 / Math.max(1, order.length));
  order.forEach((nd, i) => out.set(nd.id, 120 + i * step));
  const last = 120 + order.length * step;
  s.edges.forEach((e, i) => {
    const base = s.kind === 'sequence' ? last + i * Math.min(120, 1400 / Math.max(1, s.edges.length)) : Math.max(out.get(e.from) ?? 0, out.get(e.to) ?? 0) + 180;
    out.set(e.id, base);
  });
  return out;
}

/** `open`: ids of boxes that open into an inside diagram (badge, button role). */
export function renderScene(s: Scene, title?: string, open?: Set<string>): string {
  const dl = delays(s);
  const groups = [...s.groups].sort((a, b) => b.w * b.h - a.w * a.h).map((g) => group(g, dl)).join('');
  const lifelines = s.lifelines
    .map((l) => `<g class="dg-lifeline" style="${delayStyle(dl, l.id)}" data-el="${esc(l.id)}" data-kind="node"><line x1="${n(l.x)}" y1="${n(l.y1)}" x2="${n(l.x)}" y2="${n(l.y2)}"/></g>`)
    .join('');
  const nodes = s.nodes.map((nd) => node(nd, dl, open)).join('');
  const hops = s.kind === 'graph' ? crossings(s.edges) : new Map<string, number[][]>();
  const drawn = s.edges.map((e) => edge(e, dl, hops.get(e.id)));
  const dots = s.kind === 'graph'
    ? junctions(s.edges).map((j) => `<circle class="dg-junction tone-${j.tone}" cx="${n(j.at[0])}" cy="${n(j.at[1])}" r="3.4" data-edges="${esc(j.ids.join(' '))}"/>`).join('')
    : '';
  const edges = drawn.map((e) => e.line).join('') + dots;
  // Edge labels go last (topmost), so no line or box ever hides their text.
  const labels = drawn.map((e) => e.label).join('');
  const body = (s.kind === 'sequence' ? groups + lifelines + nodes + edges : groups + edges + nodes) + labels;
  return `<svg class="dg-scene" data-diagram="${s.kind}"${s.wires ? ` data-wires="${s.wires}"` : ''} viewBox="0 0 ${s.width} ${s.height}" role="img"${title ? ` aria-label="${esc(title)}"` : ''} xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
