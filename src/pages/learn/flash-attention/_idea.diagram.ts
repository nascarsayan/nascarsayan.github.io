/** Intuition: the Q block stays on the desk, K/V blocks come from the warehouse one at a time, three running notes replace the score sheet. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  nodes: [
    { id: 'hbm', label: 'HBM (the warehouse)', detail: 'Q, K, V, O: big, far, slow', shape: 'store', tone: 'peach' },
    { id: 'desk', label: 'On chip (the desk)', detail: 'Q block + one K/V block', tone: 'lime', info: 'LDS and registers of one workgroup: a few hundred KB, many times faster than HBM.' },
    { id: 'notes', label: 'Running notes', detail: 'm = best score · l = total · o = blend', tone: 'primary', info: 'Three small numbers (o is a d-wide vector) per query row. They replace the whole row of S and P.' },
    { id: 's', label: 'Full score sheet S', detail: 'T × T: never written', tone: 'risk', shape: 'note' },
    { id: 'out', label: 'Answer O', detail: 'written once', shape: 'external', tone: 'good' },
  ],
  edges: [
    { from: 'hbm', to: 'desk', label: 'one K/V block at a time' },
    { from: 'desk', to: 'notes', label: 'update' },
    { from: 'desk', to: 's', style: 'dashed', label: 'naive only' },
    { from: 'notes', to: 'out', label: 'o ÷ l' },
  ],
});
