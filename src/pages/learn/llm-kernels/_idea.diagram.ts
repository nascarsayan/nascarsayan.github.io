/** Intuition: a weight matrix is a heavy tool fetched from HBM each step; prefill runs thousands of rows through each fetch, decode only a few. */
import { defineDiagram } from '@/diagrams/spec';
import { layerWeightBytes, allWeightBytes } from './_example';
const gb = (b: number) => `${(b / 1e9).toFixed(1)} GB`;

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  direction: 'auto',
  nodes: [
    { id: 'w', label: 'Weights in HBM', detail: `one layer ≈ ${gb(layerWeightBytes)}, all 36 ≈ ${gb(allWeightBytes).replace('.0 ', ' ')}`, shape: 'store', tone: 'peach', side: -1, info: 'Far bigger than any cache (MI355X: 256 MB Infinity Cache), so every step reads them again from HBM.' },
    { id: 'mc', label: 'Matrix cores', detail: 'apply each weight to every row', tone: 'good' },
    { id: 'pre', label: 'Prefill rows', detail: '4,085 prompt tokens', tone: 'sky', band: -1 },
    { id: 'dec', label: 'Decode rows', detail: '64 sequences × 1 token', tone: 'pink', band: 1 },
    { id: 'kv', label: 'KV cache in HBM', detail: 'earlier tokens, per sequence', shape: 'store', tone: 'note', side: 1 },
  ],
  edges: [
    { from: 'w', to: 'mc', label: 'read once per step' },
    { from: 'pre', to: 'mc' },
    { from: 'dec', to: 'mc' },
    { from: 'kv', to: 'mc', label: 'attention reads it' },
  ],
});
