/**
 * In-process cache of laid-out scenes, keyed by the spec. The dev server renders a
 * page on every request, and a page can lay out twenty diagrams (columns
 * variants, label placement); with the cache only changed specs are laid out again.
 * Editing the layout code reloads this module, so the cache never outlives it.
 */
import type { DiagramSpec } from './spec';
import type { Scene } from './scene';
import { layoutGraph } from './graph';
import { layoutSequence } from './sequence';
import { placeLabels, type LabelOverlap } from './labels';

const cache = new Map<string, { scene: Scene; overlaps: LabelOverlap[] }>();

export function layoutScene(spec: DiagramSpec) {
  const key = JSON.stringify(spec);
  let hit = cache.get(key);
  if (!hit) {
    // Labels are drawn above boxes, so move any that would cover a box or another label.
    hit = placeLabels(spec.kind === 'graph' ? layoutGraph(spec) : layoutSequence(spec));
    cache.set(key, hit);
  }
  return hit;
}
