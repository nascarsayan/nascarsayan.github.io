/** The scheduler loop: every engine step, pick work under three limits, run one forward pass, sample, repeat. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  nodes: [
    { id: 'client', label: 'New request', detail: 'prompt tokens', shape: 'external' },
    { id: 'queue', label: 'Waiting queue', detail: 'first come, first served', shape: 'store', tone: 'muted' },
    { id: 'sched', label: 'Scheduler', detail: 'budget · sequence cap · free KV', tone: 'primary', info: 'Runs before every engine step. Decodes first, then prompt chunks until the token budget is used.' },
    { id: 'step', label: 'One forward pass', detail: 'all chosen tokens together', tone: 'pink' },
    { id: 'sample', label: 'Sample', detail: 'one token per finished prompt or decode', tone: 'good' },
    { id: 'user', label: 'Streamed to the user', shape: 'external' },
  ],
  edges: [
    { from: 'client', to: 'queue', label: 'arrives' },
    { from: 'queue', to: 'sched', label: 'admit if it fits' },
    { from: 'sched', to: 'step', label: 'this step’s batch' },
    { from: 'step', to: 'sample', label: 'logits' },
    { from: 'sample', to: 'user', label: 'token' },
    { from: 'sample', to: 'sched', label: 'not finished: decode next step', style: 'dashed' },
  ],
});
