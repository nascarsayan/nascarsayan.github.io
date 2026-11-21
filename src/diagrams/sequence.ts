/**
 * Sequence layout: participant cards across the top, dashed lifelines, one row
 * per message, frames as labelled bands. Column gaps grow to fit message labels
 * and labels wrap so the whole diagram fits the column.
 */
import type { SequenceSpec } from './spec';
import { T, type Scene, type SceneEdge, type SceneGroup, type SceneNode, type TextBlock } from './scene';
import { measure, wrap, widest } from './text';

const block = (s: string, max: number, t: { size: number; weight: 400 | 500 | 600 | 700; lineHeight: number }): TextBlock => ({
  lines: s ? wrap(s, max, t.size, t.weight) : [],
  size: t.size,
  weight: t.weight,
  lineHeight: t.lineHeight,
});

export const messageIds = (spec: SequenceSpec) => spec.messages.map((m, i) => m.id ?? `m${i + 1}`);

function attempt(spec: SequenceSpec, labelMax: number, cardMax: number): Scene {
  const pad = 12;
  const index = new Map(spec.participants.map((p, i) => [p.id, i]));
  for (const m of spec.messages)
    for (const end of [m.from, m.to]) if (!index.has(end)) throw new Error(`message ${m.from} -> ${m.to}: unknown participant ${end}`);

  // Participant cards.
  const cards = spec.participants.map((p) => {
    const label = block(p.label, cardMax, T.label);
    const detail = p.detail ? block(p.detail, cardMax, T.detail) : undefined;
    const w = Math.ceil(Math.max(T.minNodeW, widest(label.lines, T.label.size, T.label.weight), detail ? widest(detail.lines, T.detail.size, T.detail.weight) : 0) + 2 * T.padX);
    const h = Math.ceil(label.lines.length * T.label.lineHeight + (detail ? T.gap + detail.lines.length * T.detail.lineHeight : 0) + 2 * T.padY);
    return { p, label, detail, w, h };
  });
  const cardH = Math.max(...cards.map((c) => c.h));

  // Message labels and the column gaps they need.
  const ids = messageIds(spec);
  const msgs = spec.messages.map((m, i) => {
    const a = index.get(m.from)!, b = index.get(m.to)!;
    const text = block(m.label, labelMax, T.edge);
    return { m, id: ids[i], a, b, text, w: widest(text.lines, T.edge.size, T.edge.weight) };
  });
  const n = spec.participants.length;
  const gap = Array.from({ length: Math.max(0, n - 1) }, (_, i) => (cards[i].w + cards[i + 1].w) / 2 + 28);
  for (const x of msgs) {
    const lo = Math.min(x.a, x.b), hi = Math.max(x.a, x.b);
    if (lo === hi) {
      if (lo < n - 1) gap[lo] = Math.max(gap[lo], x.w + 64);
      continue;
    }
    const need = x.w + 36;
    const have = gap.slice(lo, hi).reduce((s, g) => s + g, 0);
    if (have < need) for (let k = lo; k < hi; k++) gap[k] += (need - have) / (hi - lo);
  }
  const xs = [pad + cards[0].w / 2];
  for (let i = 1; i < n; i++) xs.push(xs[i - 1] + gap[i - 1]);
  const lastSelf = msgs.some((x) => x.a === x.b && x.a === n - 1) ? Math.max(...msgs.filter((x) => x.a === x.b && x.a === n - 1).map((x) => x.w + 56)) : 0;
  const width = Math.ceil(Math.max(xs[n - 1] + cards[n - 1].w / 2, xs[n - 1] + lastSelf) + pad);

  // Rows.
  const frameStarts = new Map<string, number>();
  for (const f of spec.frames) frameStarts.set(f.from, (frameStarts.get(f.from) ?? 0) + 1);
  let y = pad + cardH + 24;
  const rows: { y: number; h: number }[] = [];
  const edges: SceneEdge[] = msgs.map((x) => {
    y += (frameStarts.get(x.id) ?? 0) * 34;
    const textH = x.text.lines.length * T.edge.lineHeight;
    const self = x.a === x.b;
    const top = y;
    const lineY = top + textH + 6;
    const h = textH + 6 + (self ? 26 : 0) + 18;
    rows.push({ y: top, h });
    y += h;
    const x1 = xs[x.a], x2 = xs[x.b];
    const points: [number, number][] = self ? [[x1, lineY], [x1 + 40, lineY], [x1 + 40, lineY + 22], [x1, lineY + 22]] : [[x1, lineY], [x2, lineY]];
    const lw = Math.ceil(x.w + 12), lh = textH + 4;
    const labelX = self ? x1 + 48 + lw / 2 : (x1 + x2) / 2;
    return {
      id: x.id, from: x.m.from, to: x.m.to, points,
      tone: x.m.tone ?? 'neutral', dashed: x.m.style === 'dashed', arrowEnd: true, arrowStart: false, self, info: x.m.info,
      label: x.text.lines.length ? { x: labelX, y: top + textH / 2 + 1, w: lw, h: lh, text: x.text } : undefined,
    };
  });
  const bottom = y + 8;

  const nodes: SceneNode[] = cards.map((c, i) => ({
    id: c.p.id, x: xs[i] - c.w / 2, y: pad, w: c.w, h: cardH, shape: 'box', tone: c.p.tone ?? 'neutral', label: c.label, detail: c.detail, info: c.p.info,
  }));
  const msgIndex = new Map(ids.map((id, i) => [id, i]));
  const groups: SceneGroup[] = spec.frames.map((f, k) => {
    const i = msgIndex.get(f.from), j = msgIndex.get(f.to);
    if (i === undefined || j === undefined || j < i) throw new Error(`frame "${f.label}": from/to must be message ids in order`);
    const span = msgs.slice(i, j + 1);
    const lo = Math.min(...span.flatMap((x) => [x.a, x.b])), hi = Math.max(...span.flatMap((x) => [x.a, x.b]));
    const selfRight = span.some((x) => x.a === x.b && x.a === hi) ? 60 : 0;
    const x1 = xs[lo] - Math.min(cards[lo].w / 2, 60) - 4;
    const x2 = xs[hi] + Math.max(Math.min(cards[hi].w / 2, 60), selfRight) + 4;
    const y1 = rows[i].y - 32, y2 = rows[j].y + rows[j].h - 4;
    return {
      id: `frame-${k + 1}`, x: x1, y: y1, w: x2 - x1, h: y2 - y1, tone: f.tone ?? 'muted',
      label: { lines: [f.label], size: T.group.size, weight: T.group.weight, lineHeight: T.group.lineHeight, upper: true },
    };
  });
  return {
    kind: 'sequence', width, height: Math.ceil(bottom + pad), groups, nodes, edges,
    lifelines: xs.map((x, i) => ({ id: spec.participants[i].id, x, y1: pad + cardH, y2: bottom })),
  };
}

export function layoutSequence(spec: SequenceSpec): Scene {
  // Narrow the label and card widths until the diagram fits the column.
  let best: Scene | undefined;
  for (const [labelMax, cardMax] of [[220, 180], [170, 150], [130, 120], [100, 100]]) {
    const s = attempt(spec, labelMax, cardMax);
    best = s;
    if (s.width <= T.fitW) break;
  }
  return best!;
}

export { measure };
