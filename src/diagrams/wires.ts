/**
 * Geometry rules for wires (orthogonal edge routes), shared by the router (graph.ts),
 * which avoids breaking them, and the lint (labels.ts collisions), which fails the build:
 *
 *   graze    a run that slides along a box's border (closer than GRAZE px, parallel to it,
 *            over more than 6 px), its own end boxes included: it reads as part of the box.
 *   close    two parallel runs of different wires closer than SEP px but not on the same
 *            line: they blur into one thick line. (Exactly on the same line is the
 *            on-top rule; wires sharing a port may share a trunk, marked by a dot.)
 *   on top   two wires on the same line over more than 6 px, unless they share a port.
 */
import type { Pt } from './scene';

export const GRAZE = 5;
export const SEP = 8;
type Rect = { x: number; y: number; w: number; h: number };
type Wire = { from: string; to: string; pts: Pt[] };

const span = (u1: number, u2: number, v1: number, v2: number) => Math.min(Math.max(u1, u2), Math.max(v1, v2)) - Math.max(Math.min(u1, u2), Math.min(v1, v2));
const isH = (a: Pt, b: Pt) => Math.abs(a[1] - b[1]) < 0.5;
const isV = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 0.5;
const runs = (pts: Pt[]) => pts.slice(1).map((b, k) => [pts[k], b] as const);

/** Boxes whose border one of the route's runs slides along. */
export function grazed<T extends Rect>(pts: Pt[], boxes: T[], g = GRAZE): T[] {
  const out = new Set<T>();
  for (const [a, b] of runs(pts)) {
    for (const o of boxes) {
      if (isH(a, b) && (Math.abs(a[1] - o.y) < g || Math.abs(a[1] - (o.y + o.h)) < g) && span(a[0], b[0], o.x + 2, o.x + o.w - 2) > 6) out.add(o);
      if (isV(a, b) && (Math.abs(a[0] - o.x) < g || Math.abs(a[0] - (o.x + o.w)) < g) && span(a[1], b[1], o.y + 2, o.y + o.h - 2) > 6) out.add(o);
    }
  }
  return [...out];
}

/** Pairs of runs: [on the same line, closer than SEP but apart]. Shared-port wires may share a line. */
export function between(p: Wire, q: Wire): { onTop: number; close: number } {
  let onTop = 0, close = 0;
  const share = p.from === q.from || p.to === q.to;
  for (const [a1, a2] of runs(p.pts)) for (const [b1, b2] of runs(q.pts)) {
    let d = Infinity, ov = 0;
    if (isH(a1, a2) && isH(b1, b2)) { d = Math.abs(a1[1] - b1[1]); ov = span(a1[0], a2[0], b1[0], b2[0]); }
    else if (isV(a1, a2) && isV(b1, b2)) { d = Math.abs(a1[0] - b1[0]); ov = span(a1[1], a2[1], b1[1], b2[1]); }
    if (ov <= 6) continue;
    if (d < 0.5) { if (!share) onTop++; }
    else if (d < SEP && ov > 8) close++;
  }
  return { onTop, close };
}

/** A run that is neither horizontal nor vertical (graph wires are orthogonal). */
export const diagonal = (pts: Pt[]) => runs(pts).some(([a, b]) => !isH(a, b) && !isV(a, b));

/** A route that is no line at all (fewer than 2 points, or no length). */
export const degenerate = (pts: Pt[]) => pts.length < 2 || runs(pts).every(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) < 1);
