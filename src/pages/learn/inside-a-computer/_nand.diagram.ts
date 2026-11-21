/** Level 2 (SSD): inside one NAND flash die. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [{ id: 'h', label: 'From big to small', tone: 'primary', direction: 'right' }],
  nodes: [
    { id: 'die', label: 'Die', detail: '1 Tbit, 4 planes', parent: 'h', tone: 'primary' },
    { id: 'plane', label: 'Plane', detail: '~2000 blocks', parent: 'h', tone: 'primary' },
    { id: 'block', label: 'Block', detail: '~1500 pages, erased at once', parent: 'h', tone: 'warn', info: 'Erase works only on a whole block (about 24 MB), and each block survives a few thousand erase cycles. That is why the FTL moves data around.' },
    { id: 'page', label: 'Page', detail: '16 KB, read / written at once', parent: 'h', tone: 'primary' },
    { id: 'cell', label: 'Cell', detail: '3 bits (TLC)', parent: 'h', tone: 'peach' },
  ],
  edges: [
    { from: 'die', to: 'plane', label: 'has' },
    { from: 'plane', to: 'block', label: 'has' },
    { from: 'block', to: 'page', label: 'has' },
    { from: 'page', to: 'cell', label: 'has' },
  ],
});
