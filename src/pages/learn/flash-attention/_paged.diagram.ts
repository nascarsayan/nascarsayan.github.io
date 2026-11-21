/** Paged decode attention: one workgroup follows a sequence's block table into scattered KV blocks. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'auto',
  direction: 'auto',
  groups: [{ id: 'pool', label: 'KV cache pool in HBM (16 tokens per block)', tone: 'peach' }],
  nodes: [
    { id: 'wg', label: 'Workgroup', detail: 'sequence A, KV head 0, 8 query heads', tone: 'primary', info: 'Holds q for the 8 query heads that share KV head 0 (GQA), and the running m, l, o in registers.' },
    { id: 'bt', label: 'Block table, seq A', detail: '[7, 2, 9]', shape: 'store', tone: 'note', info: 'Logical block 0 → physical 7, 1 → 2, 2 → 9. Written by the vLLM scheduler on the CPU, read by the kernel.' },
    { id: 'p7', label: 'Block 7', detail: 'tokens 0–15', parent: 'pool', shape: 'store' },
    { id: 'p2', label: 'Block 2', detail: 'tokens 16–31', parent: 'pool', shape: 'store' },
    { id: 'p9', label: 'Block 9', detail: 'tokens 32–40 (9 of 16 used)', parent: 'pool', shape: 'store' },
    { id: 'p4', label: 'Block 4', detail: 'another sequence', parent: 'pool', shape: 'store', tone: 'muted' },
    { id: 'out', label: 'Output', detail: 'o ÷ l for 8 query heads', shape: 'external' },
  ],
  edges: [
    { from: 'wg', to: 'bt', label: 'look up' },
    { from: 'wg', to: 'p7' },
    { from: 'wg', to: 'p2' },
    { from: 'wg', to: 'p9' },
    { from: 'wg', to: 'out' },
  ],
});
