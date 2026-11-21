/** Level 2 (RAM): one DRAM chip. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'io', label: 'Interface', tone: 'muted' },
    { id: 'banks', label: '8 bank groups × 4 banks', tone: 'primary' },
  ],
  nodes: [
    { id: 'pins', label: 'Command + address pins', detail: 'ACTIVATE, READ, WRITE…', parent: 'io' },
    { id: 'ctrl', label: 'Command decoder', detail: 'which bank, row, column', parent: 'io' },
    { id: 'dq', label: 'Data pins', detail: '8 bits, 6400 MT/s', parent: 'io', info: 'Megatransfers per second: data moves on both clock edges. 8 bits × 6400 MT/s = 6.4 GB/s per chip.' },
    { id: 'bank', label: 'Bank 0', detail: '65 536 rows × 8 KB', parent: 'banks', tone: 'primary' },
    { id: 'others', label: '31 more banks', detail: 'can work in parallel', parent: 'banks', tone: 'primary', info: 'While one bank is busy opening a row, another can be reading. The memory controller interleaves requests across banks to hide the wait.' },
  ],
  edges: [
    { from: 'ctrl', to: 'bank', label: 'row, column' },
    { from: 'bank', to: 'dq', label: '64 bits per burst', style: 'dashed' },
  ],
});
