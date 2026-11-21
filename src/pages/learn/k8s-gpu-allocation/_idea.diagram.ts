/** The idea: four questions, four pieces. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  nodes: [
    { id: 'inv', label: 'What exists?', detail: 'ResourceSlice: the seat map', tone: 'teal' },
    { id: 'req', label: 'What do I need?', detail: 'ResourceClaim: the booking', tone: 'pink' },
    { id: 'pick', label: 'Which one, where?', detail: 'scheduler: the box office', tone: 'primary' },
    { id: 'hand', label: 'How do I get it?', detail: 'kubelet + driver + CDI: the usher', tone: 'sky' },
  ],
  edges: [
    { from: 'inv', to: 'pick' },
    { from: 'req', to: 'pick' },
    { from: 'pick', to: 'hand', label: 'claim status names the GPU' },
  ],
});
