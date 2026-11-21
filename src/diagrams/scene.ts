/** Laid-out diagram, independent of how it was laid out. Coordinates in px. */
import type { Tone } from './spec';

export type Pt = [number, number];
export interface TextBlock { lines: string[]; size: number; weight: 400 | 500 | 600 | 700; lineHeight: number; upper?: boolean }

export interface SceneNode {
  id: string;
  x: number; y: number; w: number; h: number;
  shape: 'box' | 'store' | 'external' | 'note' | 'pill';
  parent?: string;
  info?: string;
  tone: Tone;
  tag?: TextBlock;
  label: TextBlock;
  detail?: TextBlock;
  /** Text inset when not the default T.padX / T.padY (tight `layers` stacks). */
  pad?: { x: number; y: number };
}
export interface SceneGroup { id: string; x: number; y: number; w: number; h: number; tone: Tone; label?: TextBlock; parent?: string }
export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  points: Pt[];
  tone: Tone;
  dashed: boolean;
  arrowStart: boolean;
  arrowEnd: boolean;
  label?: { x: number; y: number; w: number; h: number; text: TextBlock };
  /** Card text when the arrow is clicked (Markdown). */
  info?: string;
  /** Sequence self-message: drawn as a loop. */
  self?: boolean;
}
export interface SceneLifeline { id: string; x: number; y1: number; y2: number }
export interface Scene {
  kind: 'graph' | 'sequence';
  /** Wires drawn in their tone colour (spec `wires: 'nets'`). */
  wires?: 'nets';
  width: number;
  height: number;
  groups: SceneGroup[];
  nodes: SceneNode[];
  edges: SceneEdge[];
  lifelines: SceneLifeline[];
}

/** Typography and spacing shared by layout and rendering. */
export const T = {
  tag: { size: 10.5, weight: 600 as const, lineHeight: 14, tracking: 0.06 },
  label: { size: 14, weight: 600 as const, lineHeight: 18 },
  detail: { size: 12, weight: 400 as const, lineHeight: 16 },
  group: { size: 11, weight: 600 as const, lineHeight: 14, tracking: 0.08 },
  edge: { size: 11.5, weight: 500 as const, lineHeight: 14 },
  padX: 14,
  padY: 11,
  gap: 3,
  minNodeW: 96,
  /** Target box the layout should fit at scale 1 (article column, most screens). */
  fitW: 1080,
  /** Shortest straight run allowed in an edge; the last run carries the arrowhead. Linted. */
  minSeg: 14,
  minLast: 18,
  /** 16:8 with fitW: leaves room under a diagram for its caption and controls. */
  fitH: 540,
};
