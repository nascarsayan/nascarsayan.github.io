/**
 * Diagram specs: typed TypeScript objects next to the page. Layout advice
 * (aim 2:1, auto vs columns vs tala, bands/sides, fixes): ./GUIDELINES.md. E.g.
 *
 *   // flow.diagram.ts
 *   import { defineDiagram } from '@/diagrams/spec';
 *   export default defineDiagram({
 *     kind: 'graph',
 *     groups: [{ id: 'cp', label: 'Control plane', tone: 'primary' }],
 *     nodes: [
 *       { id: 'client', label: 'Every client', tag: 'client' },
 *       { id: 'hap', label: 'HAProxy', detail: 'health checks', parent: 'cp' },
 *     ],
 *     edges: [{ from: 'client', to: 'hap', label: 'pull' }],
 *   });
 *
 * Ids: nodes and groups by `id`; edges by `id` or `from -> to` (a second edge
 * between the same pair is `from -> to #2`); sequence messages by `id` or `m1`, `m2`…
 */
import { z } from 'astro/zod';

const id = z.string().regex(/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/, 'ids: letters, digits, _ . -');
const text = (max: number) => z.string().min(1).max(max);
// Semantic tones first; the rest are plain hues (Catppuccin-based) for telling parts apart.
export const Tone = z.enum(['neutral', 'primary', 'good', 'warn', 'risk', 'note', 'muted', 'violet', 'teal', 'sky', 'pink', 'peach', 'lime']);
export type Tone = z.infer<typeof Tone>;

const GraphNode = z.object({
  id,
  label: text(120),
  detail: z.string().max(400).optional(),
  /**
   * Longer explanation, not in the box (keeps boxes small): the box gets an "i" button on its
   * top-left corner that shows it in a card. Markdown: paragraphs, "- " lists, `code`, **bold**, *italic*, [links](https://…).
   */
  info: z.string().max(2000).optional(),
  tag: z.string().max(40).optional(),
  tone: Tone.optional(),
  shape: z.enum(['box', 'store', 'external', 'note', 'pill']).optional(),
  parent: id.optional(),
  /**
   * `columns` layout: a full-width row above (negative) or below (positive) the
   * columns, e.g. clients at -2, a switch at -1, shared storage at 1. A node
   * alone in its band spans the full width.
   */
  band: z.number().int().min(-3).max(3).refine((v) => v !== 0, 'band is non-zero').optional(),
  /**
   * `columns` layout: a full-height strip left (negative) or right (positive) of
   * the columns, e.g. clients at -2, a switch at -1, storage at 1. A node alone
   * in its strip spans the full height; several stack.
   */
  side: z.number().int().min(-3).max(3).refine((v) => v !== 0, 'side is non-zero').optional(),
}).strict();

const GraphGroup = z.object({
  id,
  label: z.string().max(120).optional(),
  tone: Tone.optional(),
  parent: id.optional(),
  direction: z.enum(['right', 'down']).optional(),
}).strict();

const GraphEdge = z.object({
  id: id.optional(),
  from: id,
  to: id,
  label: z.string().max(120).optional(),
  tone: Tone.optional(),
  style: z.enum(['solid', 'dashed']).optional(),
  arrow: z.enum(['end', 'both', 'none']).optional(),
  /** Shown when the arrow or its label is clicked (Markdown, like a box's `info`). */
  info: z.string().max(2000).optional(),
  /** Justification for keeping a run shorter than the lint minimum on this edge. */
  allowShort: z.string().min(12).optional(),
}).strict();

export const GraphSpec = z.object({
  kind: z.literal('graph'),
  /**
   * `tala`: TALA places everything (architecture-style graphs).
   * `columns`: each top-level group is a column of stacked steps; columns wrap
   * into rows to fit (pipelines). `auto`: TALA, unless columns fit better.
   */
  /** `layers`: one top group per row, top to bottom in spec order, all the same width, boxes centred
   *  (a stack such as workload / platform / host / hardware). */
  layout: z.enum(['auto', 'tala', 'columns', 'layers']).default('auto'),
  /** Justification for allowing short edge runs anywhere in this diagram. */
  allowShort: z.string().min(12).optional(),
  /** Justification for a shape outside the aspect lint (width/height 1.5–3.5, aim 16:8). Last resort. */
  allowAspect: z.string().min(12).optional(),
  /** Justification for wires closer than 8px side by side, or along a box border (wires.ts), when no layout avoids it. Last resort. */
  allowClose: z.string().min(12).optional(),
  /** Justification for boxes much larger than their text (lintBoxFit). Last resort. */
  allowBoxFit: z.string().min(12).optional(),
  /** What the colours mean, drawn inside the diagram frame under the drawing: [{ tone, label }]. */
  legend: z.array(z.object({ tone: Tone, label: text(120) }).strict()).max(8).optional(),
  /**
   * `nets`: colour wires by where they come from (one hue per source box, like the nets of a
   * circuit), for diagrams where many lines cross. Edges with their own `tone` keep it.
   */
  wires: z.enum(['plain', 'nets']).default('plain'),
  /** TALA direction; `auto` tries both and keeps the one that fits best. */
  direction: z.enum(['auto', 'right', 'down']).default('auto'),
  groups: z.array(GraphGroup).max(100).default([]),
  nodes: z.array(GraphNode).min(1).max(200),
  edges: z.array(GraphEdge).max(400).default([]),
}).strict();

const Participant = z.object({ id, label: text(80), detail: z.string().max(120).optional(), info: z.string().max(2000).optional(), tone: Tone.optional() }).strict();
const Message = z.object({
  id: id.optional(),
  from: id,
  to: id,
  label: z.string().max(200).default(''),
  /** Shown when the arrow or its label is clicked (Markdown, like a box's `info`). */
  info: z.string().max(2000).optional(),
  tone: Tone.optional(),
  style: z.enum(['solid', 'dashed']).optional(),
  allowShort: z.string().min(12).optional(),
}).strict();
const Frame = z.object({
  label: text(80),
  /** First and last message ids (inclusive). */
  from: id,
  to: id,
  tone: Tone.optional(),
}).strict();

export const SequenceSpec = z.object({
  kind: z.literal('sequence'),
  participants: z.array(Participant).min(1).max(16),
  messages: z.array(Message).max(120),
  frames: z.array(Frame).max(30).default([]),
  allowShort: z.string().min(12).optional(),
  /** What the colours mean, drawn inside the diagram frame under the drawing: [{ tone, label }]. */
  legend: z.array(z.object({ tone: Tone, label: text(120) }).strict()).max(8).optional(),
}).strict();

export const DiagramSpec = z.discriminatedUnion('kind', [GraphSpec, SequenceSpec]);
export type GraphSpec = z.infer<typeof GraphSpec>;
export type SequenceSpec = z.infer<typeof SequenceSpec>;
export type DiagramSpec = z.infer<typeof DiagramSpec>;
export type DiagramInput = z.input<typeof DiagramSpec>;

/** Identity helper for type-checked specs; validation happens at render. */
export const defineDiagram = <T extends DiagramInput>(spec: T): T => spec;
