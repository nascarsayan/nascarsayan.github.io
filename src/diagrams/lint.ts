/**
 * Diagram lint, run at build time by <Diagram>. Edges are drawn as straight
 * runs; every run must be at least T.minSeg long and the last run (which
 * carries the arrowhead) at least T.minLast, so corners read as rectangles.
 * Bypass only with a written reason: `allowShort: '…'` on the edge or message,
 * or on the whole diagram.
 */
import type { DiagramSpec } from './spec';
import { T, type Scene, type SceneNode } from './scene';
import { widest } from './text';
import { edgeIds, isBusNode } from './graph';
import { messageIds } from './sequence';

export interface LintIssue { edge: string; runs: number[] }

export function lintScene(spec: DiagramSpec, scene: Scene): LintIssue[] {
  if (spec.allowShort) return [];
  const allowed = new Set<string>();
  if (spec.kind === 'graph') {
    const ids = edgeIds(spec.edges);
    spec.edges.forEach((e, i) => { if (e.allowShort) allowed.add(ids[i]); });
  } else {
    const ids = messageIds(spec);
    spec.messages.forEach((m, i) => { if (m.allowShort) allowed.add(ids[i]); });
  }
  const issues: LintIssue[] = [];
  for (const e of scene.edges) {
    if (allowed.has(e.id) || e.points.length < 2) continue;
    const runs = e.points.slice(1).map((p, k) => Math.round(Math.hypot(p[0] - e.points[k][0], p[1] - e.points[k][1])));
    const bad = runs.some((len, k) => len < (k === runs.length - 1 ? T.minLast : T.minSeg));
    if (bad) issues.push({ edge: e.id, runs });
  }
  return issues;
}

/**
 * Overlap rules (build errors, like short runs): an edge must not run through
 * a box that is not one of its ends, and an edge label must not cover a box or
 * another label (after placeLabels). See collisions() in labels.ts.
 */
export { collisions as lintOverlaps } from './labels';

/**
 * Aspect lint for graphs (sequences are exempt: they grow with their messages
 * and scroll). Diagrams should read like a 16:8 slide (room left for the caption
 * and controls under them): width ÷ height within
 * [ASPECT.min, ASPECT.max]. Too tall wastes the screen and needs scrolling; too
 * wide shrinks the text. Small tall blocks (≤ 420 px) and strips that fit the
 * column at full size pass. Bypass only with `allowAspect: '<reason>'`.
 */
export const ASPECT = { min: 1.5, max: 3.5, target: 2, tallOver: 420, wideOver: T.fitW };
export function lintAspect(spec: DiagramSpec, scene: Scene): string | null {
  if (spec.kind !== 'graph' || spec.allowAspect) return null;
  const r = scene.width / scene.height;
  // Only shapes that hurt: tall ones beyond a short block, wide ones that must shrink to fit the column.
  const tooTall = r < ASPECT.min && scene.height > ASPECT.tallOver;
  const tooWide = r > ASPECT.max && scene.width > ASPECT.wideOver;
  if (!tooTall && !tooWide) return null;
  return `${scene.width}×${scene.height} is ${r.toFixed(2)}:1 (${r < ASPECT.min ? 'too tall' : 'too wide'}; allowed ${ASPECT.min}–${ASPECT.max}, aim ${ASPECT.target.toFixed(2)})`;
}

/**
 * Box-fit lint for graphs: a box may not be much larger than its text needs
 * (label, detail, tag plus padding). Big empty boxes waste space and read as
 * more important than they are. Fails when a box is more than BOXFIT.w times
 * (and more than BOXFIT.dw px) wider, or BOXFIT.h times (and BOXFIT.dh px)
 * taller, than its content. Buses (nodes linked to 3+ boxes, which the
 * engine may stretch along a band or side strip) are exempt: they span their strip on purpose. Bypass: `allowBoxFit: '<reason>'`.
 */
export const BOXFIT = { w: 1.5, dw: 60, h: 1.6, dh: 30 };
export function lintBoxFit(spec: DiagramSpec, scene: Scene, alts: { id: string; node: SceneNode }[] = []): string[] {
  if (spec.kind !== 'graph' || spec.allowBoxFit) return [];
  const out: string[] = [];
  // Buses (linked to 3+ boxes) may span a strip: the author's or the engine's.
  const banded = new Set(spec.nodes.filter((n) => isBusNode(spec, n.id)).map((n) => n.id));
  const need = (n: SceneNode) => {
    const tw = Math.max(
      widest(n.label.lines, n.label.size, n.label.weight),
      n.detail ? widest(n.detail.lines, n.detail.size, n.detail.weight) : 0,
      n.tag ? widest(n.tag.lines.map((l) => l.toUpperCase()), n.tag.size, n.tag.weight) * 1.08 : 0,
    );
    const th = (n.tag ? n.tag.lineHeight + T.gap : 0) + n.label.lines.length * n.label.lineHeight + (n.detail ? T.gap + n.detail.lines.length * n.detail.lineHeight : 0);
    return { w: Math.max(T.minNodeW, tw + 2 * T.padX) + (n.shape === 'pill' ? 12 : 0), h: th + 2 * T.padY + (n.shape === 'store' ? 16 : 0) };
  };
  for (const n of scene.nodes) {
    if (banded.has(n.id)) continue; // buses span their strip on purpose
    // A box must also fit the text a Step swaps in: measure against the largest.
    const all = [need(n), ...alts.filter((a) => a.id === n.id).map((a) => need(a.node))];
    const needW = Math.max(...all.map((x) => x.w)), needH = Math.max(...all.map((x) => x.h));
    const wide = n.w > needW * BOXFIT.w && n.w - needW > BOXFIT.dw;
    const tall = n.h > needH * BOXFIT.h && n.h - needH > BOXFIT.dh;
    if (wide || tall) out.push(`${n.id}: ${Math.round(n.w)}×${Math.round(n.h)} for ${Math.round(needW)}×${Math.round(needH)} of content`);
  }
  return out;
}

/**
 * Text must stay inside its box: every line of the tag, label and detail fits the box's
 * width, and all lines fit its height. Checks each box's own text and every text a Step
 * swaps in (`alts`: the box with that text, wrapped to the box). A word longer than the
 * box (a long id) also fails here: break it, or shorten it.
 */
export function lintTextFit(scene: Scene, alts: { id: string; node: SceneNode }[] = []): string[] {
  if (scene.kind !== 'graph') return [];
  const out: string[] = [];
  const check = (nd: SceneNode, what: string) => {
    const inner = nd.w - 2 * (nd.pad?.x ?? T.padX) + 2 - (nd.shape === 'pill' ? 12 : 0);
    const blocks = [nd.tag, nd.label, nd.detail].filter(Boolean) as NonNullable<SceneNode['detail']>[];
    for (const b of blocks) {
      const w = widest(b.upper ? b.lines.map((l) => l.toUpperCase()) : b.lines, b.size, b.weight) * (b.upper ? 1.08 : 1);
      if (w > inner) { out.push(`${nd.id}${what}: "${b.lines.join(' ')}" is ${Math.round(w)}px wide, box fits ${Math.round(inner)}px`); return; }
    }
    const h = blocks.reduce((s, b) => s + b.lines.length * b.lineHeight, 0) + (blocks.length - 1) * T.gap;
    const room = nd.h - 2 * (nd.pad?.y ?? T.padY) + 2 - (nd.shape === 'store' ? 16 : 0);
    if (h > room) out.push(`${nd.id}${what}: text is ${Math.round(h)}px tall, box fits ${Math.round(room)}px`);
  };
  for (const nd of scene.nodes) check(nd, '');
  for (const a of alts) check(a.node, ' (step state)');
  // Group titles: one line, drawn from 14px inside the left edge; keep 10px clear on the right.
  for (const g of scene.groups) {
    if (!g.label) continue;
    const w = widest(g.label.lines.map((l) => l.toUpperCase()), g.label.size, g.label.weight) * 1.08;
    if (w > g.w - 24) out.push(`group ${g.id}: title "${g.label.lines.join(' ')}" is ${Math.round(w)}px wide, box fits ${Math.round(g.w - 24)}px`);
  }
  return out;
}

/**
 * Group boxes sized to what they hold. A group (column, strip, nested box) fails when
 * it is more than GROUPFIT.h times (and GROUPFIT.dh px) taller, or GROUPFIT.w times
 * (and GROUPFIT.dw px) wider, than its boxes, sub-groups and label need: an empty
 * stretch of a group reads as "something is missing here". Bypass: allowBoxFit.
 */
export const GROUPFIT = { w: 1.6, dw: 120, h: 1.5, dh: 60, pad: 24 };
export function lintGroupFit(spec: DiagramSpec, scene: Scene): string[] {
  if (spec.kind !== 'graph' || spec.allowBoxFit) return [];
  const out: string[] = [];
  for (const g of scene.groups) {
    const kids = [...scene.nodes.filter((n) => n.parent === g.id), ...scene.groups.filter((c) => c.parent === g.id)];
    if (!kids.length) continue;
    const x1 = Math.min(...kids.map((k) => k.x)), x2 = Math.max(...kids.map((k) => k.x + k.w));
    const y2 = Math.max(...kids.map((k) => k.y + k.h));
    const labelW = g.label ? widest(g.label.lines, g.label.size, g.label.weight) * 1.1 + 2 * 16 : 0;
    const needW = Math.max(x2 - x1 + 2 * GROUPFIT.pad, labelW);
    const needH = y2 - g.y + GROUPFIT.pad;
    const tall = g.h > needH * GROUPFIT.h && g.h - needH > GROUPFIT.dh;
    // `layers` makes every layer as wide as the widest on purpose.
    const wide = (spec as { layout?: string }).layout !== 'layers' && g.w > needW * GROUPFIT.w && g.w - needW > GROUPFIT.dw;
    if (tall || wide) out.push(`group ${g.id}: ${Math.round(g.w)}×${Math.round(g.h)} for ${Math.round(needW)}×${Math.round(needH)} of content`);
  }
  return out;
}
