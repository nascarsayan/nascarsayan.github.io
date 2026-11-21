/**
 * Drill-down diagrams: a diagram whose boxes open into their own inside diagram,
 * drawn below it with dotted lens lines from the box to the panel. Levels nest
 * to any depth. Rendered by <Drilldown> (components/content/Drilldown.astro).
 *
 *   // _computer.drill.ts
 *   import { defineDrill } from '@/diagrams/drilldown';
 *   import board from './_board.diagram';
 *   import cpu from './_cpu.diagram';
 *   import core from './_core.diagram';
 *   export default defineDrill({
 *     title: 'The computer', spec: board,
 *     inside: {
 *       cpu: { title: 'Inside the CPU', spec: cpu, inside: { core: { title: 'One core', spec: core } } },
 *     },
 *   });
 *
 * A level may carry `about`: a short note shown above its diagram that complements it.
 * Keys of `inside` are box ids of `spec` (build error otherwise). Every level is a
 * normal <Diagram>, so every diagram lint applies to every level.
 */
import type { DiagramInput } from './spec';

export interface Drill {
  /** Shown as the level's diagram title and in the breadcrumb (keep it short). */
  title: string;
  spec: DiagramInput;
  caption?: string;
  /**
   * Optional text for this level, shown above its diagram: what the picture cannot say
   * (why it is built this way, numbers that matter, what goes wrong). Markdown as in
   * src/diagrams/md.ts. Do not repeat the box labels.
   */
  about?: string;
  /** Box id in `spec` -> the diagram of what is inside that box. */
  inside?: Record<string, Drill>;
}

export const defineDrill = (d: Drill): Drill => d;

/** Number of levels in the tree (for the outline's count). */
export const drillCount = (d: Drill): number => 1 + Object.values(d.inside ?? {}).reduce((s, c) => s + drillCount(c), 0);
