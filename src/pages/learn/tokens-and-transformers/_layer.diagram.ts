/** One forward pass of gpt-oss-120b: tokens in, next-token probabilities out. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'auto',
  direction: 'auto',
  groups: [{ id: 'layer', label: 'Transformer layer × 36', tone: 'pink' }],
  nodes: [
    { id: 'text', label: 'Text', detail: '"kubectl get pods"', shape: 'external' },
    { id: 'tok', label: 'Tokenizer', detail: 'o200k_harmony BPE → token ids' },
    { id: 'emb', label: 'Embedding lookup', detail: 'id → vector of 2,880', tone: 'sky' },
    { id: 'attn', label: 'RMSNorm → attention', detail: '64 Q heads, 8 KV heads, RoPE', parent: 'layer', tone: 'violet', info: 'The only step where tokens see each other. Keys and values are kept in the KV cache.' },
    { id: 'moe', label: 'RMSNorm → MoE MLP', detail: 'router picks 4 of 128 experts', parent: 'layer', tone: 'peach', info: 'Applied to each token on its own. Holds over 98% of the weights.' },
    { id: 'head', label: 'Final RMSNorm → unembedding', detail: '2,880 → 201,088 logits', tone: 'sky' },
    { id: 'samp', label: 'Sampler', detail: 'softmax, temperature, top-p', tone: 'good' },
    { id: 'next', label: 'Next token', shape: 'external' },
  ],
  edges: [
    { from: 'text', to: 'tok' },
    { from: 'tok', to: 'emb', label: 'token ids' },
    { from: 'emb', to: 'attn', label: 'residual stream' },
    { from: 'attn', to: 'moe', label: 'x + attention' },
    { from: 'moe', to: 'head', label: 'x + MLP, after layer 36' },
    { from: 'head', to: 'samp', label: 'last position only' },
    { from: 'samp', to: 'next' },
  ],
});
