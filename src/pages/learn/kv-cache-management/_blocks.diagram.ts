/** Block tables: two sequences, one shared prefix block. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'auto',
  direction: 'auto',
  groups: [
    { id: 'tables', label: 'Block tables (per sequence)', tone: 'primary' },
    { id: 'pool', label: 'Physical KV blocks in HBM (128 tokens each)', tone: 'note' },
  ],
  nodes: [
    { id: 'ta', label: 'Request A', detail: 'logical 0, 1, 2', parent: 'tables' },
    { id: 'tb', label: 'Request B', detail: 'logical 0, 1', parent: 'tables' },
    { id: 'p7', label: 'Block 7', detail: 'system prompt · refcount 2', parent: 'pool', shape: 'store', tone: 'good', info: 'Same tokens from position 0, same hash chain, so one copy serves both requests.' },
    { id: 'p2', label: 'Block 2', detail: 'A: tokens 128–255', parent: 'pool', shape: 'store' },
    { id: 'p19', label: 'Block 19', detail: 'A: tokens 256–300, partly full', parent: 'pool', shape: 'store' },
    { id: 'p4', label: 'Block 4', detail: 'B: tokens 128–200, partly full', parent: 'pool', shape: 'store' },
    { id: 'free', label: 'Free and evictable blocks', detail: 'LRU, reused on demand', parent: 'pool', shape: 'store', tone: 'muted' },
  ],
  edges: [
    { from: 'ta', to: 'p7', label: '0' },
    { from: 'tb', to: 'p7', label: '0' },
    { from: 'ta', to: 'p2', label: '1' },
    { from: 'ta', to: 'p19', label: '2' },
    { from: 'tb', to: 'p4', label: '1' },
  ],
});
