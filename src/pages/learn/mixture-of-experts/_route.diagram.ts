/** Top-4 routing in one gpt-oss-120b MoE layer; experts and weights from the worked example (_example.ts). */
import { defineDiagram } from '@/diagrams/spec';
import { top, weights, topScores } from './_example';

const ids = top.map((e) => `e${e}`);
export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  direction: 'auto',
  groups: [{ id: 'experts', label: '128 experts (SwiGLU MLPs)', tone: 'peach' }],
  nodes: [
    { id: 'x', label: 'Token vector', detail: 'normed, 2,880', shape: 'external', band: -2 },
    { id: 'router', label: 'Router', detail: '2,880 × 128 → scores, keep top 4', tone: 'violet', band: -1, info: 'Softmax over the 4 kept scores gives the mixing weights.' },
    ...top.map((e, k) => ({ id: ids[k], label: `Expert ${e}`, detail: `score ${topScores[k]} · weight ${weights[k].toFixed(2)}`, parent: 'experts', tone: 'good' as const })),
    { id: 'rest', label: '124 others', detail: 'skipped for this token', parent: 'experts', tone: 'muted' as const },
    { id: 'sum', label: 'Weighted sum', detail: 'added to residual stream', tone: 'sky', band: 1 },
  ],
  edges: [
    { from: 'x', to: 'router' },
    ...ids.map((id) => ({ from: 'router', to: id })),
    ...ids.map((id) => ({ from: id, to: 'sum' })),
  ],
});
