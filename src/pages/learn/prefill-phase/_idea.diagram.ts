/** The idea of prefill: read the whole prompt at once, leave notes (KV) for decode. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  direction: 'auto',
  nodes: [
    { id: 'prompt', label: 'Whole prompt', detail: 'every token known up front', shape: 'external', side: -1 },
    { id: 'pass', label: 'One pass, all tokens together', detail: 'weights read once, used by all', tone: 'pink', info: 'Like reading a whole page at once instead of word by word: each layer handles every prompt token in one big matrix multiply.' },
    { id: 'kv', label: 'KV cache', detail: 'a key and value per token per layer', shape: 'store', tone: 'note', info: 'The notes prefill leaves behind, so decode never has to reread the prompt.' },
    { id: 'first', label: 'First output token', detail: 'from the last position', tone: 'good' },
    { id: 'dec', label: 'Decode', detail: 'same GPU or a separate pool', shape: 'external', side: 1 },
  ],
  edges: [
    { from: 'prompt', to: 'pass' },
    { from: 'pass', to: 'kv', label: 'writes' },
    { from: 'pass', to: 'first', label: 'predicts' },
    { from: 'kv', to: 'dec', label: 'read every step' },
    { from: 'first', to: 'dec' },
  ],
});
