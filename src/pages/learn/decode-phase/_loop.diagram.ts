/** The decode loop: one token per sequence per step. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'auto',
  direction: 'auto',
  nodes: [
    { id: 'tok', label: 'Last token of each sequence', detail: 'batch of B tokens', shape: 'external' },
    { id: 'model', label: 'Forward pass, 36 layers', detail: 'reads weights once for the batch', tone: 'violet', info: 'Weights are shared by the batch; experts only partly (MoE).' },
    { id: 'kv', label: 'KV cache', detail: 'each sequence reads its own history', shape: 'store', tone: 'note' },
    { id: 'samp', label: 'Sample', detail: 'one token per sequence', tone: 'good' },
    { id: 'user', label: 'Stream to users', shape: 'external' },
  ],
  edges: [
    { from: 'tok', to: 'model' },
    { from: 'kv', to: 'model', label: 'read all K, V' },
    { from: 'model', to: 'kv', label: 'append 1 K, V per layer', style: 'dashed' },
    { from: 'model', to: 'samp', label: 'logits' },
    { from: 'samp', to: 'user' },
    { from: 'samp', to: 'tok', label: 'next step', style: 'dashed' },
  ],
});
