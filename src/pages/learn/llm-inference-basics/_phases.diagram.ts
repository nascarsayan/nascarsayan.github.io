/** Prefill then decode, with the KV cache between them. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  nodes: [
    { id: 'prompt', label: 'Prompt', detail: '4,085 tokens', shape: 'external' },
    { id: 'pre', label: 'Prefill', detail: 'one parallel pass · compute-bound', tone: 'pink' },
    { id: 'kv', label: 'KV cache', detail: 'keys + values per layer per token', shape: 'store', tone: 'note' },
    { id: 'dec', label: 'Decode', detail: 'one token per step · bandwidth-bound', tone: 'violet' },
    { id: 'out', label: 'Output tokens', shape: 'external' },
  ],
  edges: [
    { from: 'prompt', to: 'pre' },
    { from: 'pre', to: 'kv', label: 'writes' },
    { from: 'kv', to: 'dec', label: 'reads' },
    { from: 'dec', to: 'kv', label: 'appends', style: 'dashed' },
    { from: 'dec', to: 'out' },
  ],
});
