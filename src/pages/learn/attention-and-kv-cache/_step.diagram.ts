/** One decode step through one attention layer, with the KV cache. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  nodes: [
    { id: 'x', label: 'New token', detail: 'normed hidden state, 2,880', shape: 'external' },
    { id: 'proj', label: 'Q, K, V projections', detail: 'Q: 64 heads × 64 · K, V: 8 heads × 64', tone: 'violet', info: 'Three matrix multiplies, then RoPE on Q and K.' },
    { id: 'cache', label: 'KV cache', detail: 'K and V of every earlier token', shape: 'store', tone: 'note', info: '2 KiB per token per layer in gpt-oss-120b (16-bit).' },
    { id: 'score', label: 'Scores + softmax', detail: 'q · k / √64 over all cached keys', tone: 'pink' },
    { id: 'mix', label: 'Weighted sum of V', detail: 'then output matrix 4,096 → 2,880', tone: 'pink' },
    { id: 'out', label: 'Added to residual stream', shape: 'external' },
  ],
  edges: [
    { from: 'x', to: 'proj' },
    { from: 'proj', to: 'cache', label: 'append new K, V' },
    { from: 'proj', to: 'score', label: 'q' },
    { from: 'cache', to: 'score', label: 'all keys' },
    { from: 'cache', to: 'mix', label: 'all values' },
    { from: 'score', to: 'mix', label: 'weights' },
    { from: 'mix', to: 'out' },
  ],
});
