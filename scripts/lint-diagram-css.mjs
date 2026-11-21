#!/usr/bin/env node
/**
 * Style lint for src/styles/diagram.css (runs before every build).
 *
 * Edge lines are open paths (fill: none) and arrowheads are solid triangles
 * (stroke: none). An animation that sets `fill` on a line fills the whole path
 * shape (a big coloured blob); one that sets `stroke` on an arrowhead fattens
 * it. So: keyframes used on `.dg-line` may only animate stroke properties, and
 * keyframes used on `.dg-arrow` may only animate fill.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const file = join(import.meta.dirname, '..', 'src', 'styles', 'diagram.css');
const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const keyframes = new Map();
for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
  keyframes.set(m[1], [...m[2].matchAll(/([\w-]+)\s*:/g)].map((p) => p[1]));
}
const errors = [];
for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = rule[1].trim();
  const anim = /animation(?:-name)?\s*:\s*([\w-]+)/.exec(rule[2]);
  if (!anim || !keyframes.has(anim[1])) continue;
  const props = keyframes.get(anim[1]);
  // The part each selector targets: the last compound selector.
  for (const sel of selector.split(',')) {
    const last = sel.trim().split(/\s+/).pop() ?? '';
    if (/\.dg-line\b/.test(last) && props.includes('fill')) errors.push(`${sel.trim()}: @keyframes ${anim[1]} sets fill on an edge line`);
    if (/\.dg-arrow\b/.test(last) && props.some((p) => p.startsWith('stroke'))) errors.push(`${sel.trim()}: @keyframes ${anim[1]} sets stroke on an arrowhead`);
  }
}
if (errors.length) {
  console.error(`lint-diagram-css: ${file}\n  ${errors.join('\n  ')}\nUse separate keyframes for lines (stroke only) and arrowheads (fill only).`);
  process.exit(1);
}
