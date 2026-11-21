/** Intuition: one token's query, everyone's keys (labels) and values (contents). Weights from _example.ts. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  allowShort: 'four parallel lookups between narrow columns',
  groups: [
    { id: 'ask', label: '1 · Ask (query)', tone: 'pink' },
    { id: 'keys', label: '2 · Keys: compare', tone: 'sky' },
    { id: 'vals', label: '3 · Values', tone: 'teal' },
    { id: 'res', label: 'Result', tone: 'good' },
  ],
  nodes: [
    { id: 'q', label: '“fast” asks', parent: 'ask', detail: 'what am I describing?' },
    { id: 'kThe', label: 'The', parent: 'keys', detail: 'function word · weak match' },
    { id: 'kGPU', label: 'GPU', parent: 'keys', detail: 'a thing, a noun · strong match', tone: 'primary' },
    { id: 'kis', label: 'is', parent: 'keys', detail: 'linking verb · weak match' },
    { id: 'kfast', label: 'fast', parent: 'keys', detail: 'describing word · strong match' },
    { id: 'vThe', label: 'V(The)', parent: 'vals', detail: '× 0.06' },
    { id: 'vGPU', label: 'V(GPU)', parent: 'vals', detail: '× 0.42', tone: 'primary' },
    { id: 'vis', label: 'V(is)', parent: 'vals', detail: '× 0.10' },
    { id: 'vfast', label: 'V(fast)', parent: 'vals', detail: '× 0.42' },
    { id: 'out', label: 'new “fast”', parent: 'res', detail: 'now carries “about a GPU”' },
  ],
  edges: [
    { from: 'q', to: 'kThe' },
    { from: 'q', to: 'kGPU', tone: 'primary' },
    { from: 'q', to: 'kis' },
    { from: 'q', to: 'kfast' },
    { from: 'kThe', to: 'vThe' },
    { from: 'kGPU', to: 'vGPU', tone: 'primary' },
    { from: 'kis', to: 'vis' },
    { from: 'kfast', to: 'vfast' },
    { from: 'vThe', to: 'out' },
    { from: 'vGPU', to: 'out', tone: 'primary' },
    { from: 'vis', to: 'out' },
    { from: 'vfast', to: 'out' },
  ],
});
