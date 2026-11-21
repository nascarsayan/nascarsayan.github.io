/** One speculative decoding round with k = 4 (greedy acceptance). */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'draft', label: 'Draft model', detail: 'small, fast', tone: 'peach' },
    { id: 'target', label: 'Target model', detail: 'gpt-oss-120b', tone: 'violet' },
    { id: 'out', label: 'Output', tone: 'good' },
  ],
  messages: [
    { from: 'draft', to: 'draft', label: '4 cheap steps: "the" "pod" "is" "ready"' },
    { from: 'draft', to: 'target', label: 'propose 4 tokens' },
    { from: 'target', to: 'target', label: 'one forward pass over 5 positions' },
    { from: 'target', to: 'out', label: 'accept "the", "pod"', tone: 'good' },
    { from: 'target', to: 'out', label: 'reject "is": emit target token "was"', tone: 'warn' },
    { from: 'target', to: 'draft', label: 'drop KV of "is" and "ready"; next round', style: 'dashed' },
  ],
  frames: [
    { label: 'Draft', from: 'm1', to: 'm2', tone: 'peach' },
    { label: 'Verify', from: 'm3', to: 'm5', tone: 'primary' },
  ],
});
