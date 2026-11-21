/** Level 3 (RAM): one bank: rows of cells, sense amplifiers, row buffer. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'row', label: '1 · ACTIVATE a row', tone: 'warn' },
    { id: 'arr', label: '2 · Cell array', tone: 'primary' },
    { id: 'col', label: '3 · READ a column', tone: 'good' },
  ],
  nodes: [
    { id: 'rdec', label: 'Row decoder', detail: 'row address → 1 word line', parent: 'row', tone: 'warn' },
    { id: 'cells', label: 'Cells', detail: '65 536 × 65 536 bits', parent: 'arr', tone: 'primary' },
    { id: 'sa', label: 'Sense amplifiers', detail: 'one per bit line', parent: 'arr', tone: 'primary', info: 'A cell\'s charge is tiny. Opening a row moves each bit line by about 0.1 V, and the sense amps blow that up to a full 0 or 1, rewriting the cells as they go (reading a DRAM row erases it).' },
    { id: 'buf', label: 'Row buffer', detail: '8 KB open row', shape: 'store', parent: 'col', tone: 'good' },
    { id: 'cdec', label: 'Column decoder', detail: 'picks 64 bits', parent: 'col', tone: 'good', info: 'Reading more from the open row is fast (a "row hit"). A different row needs PRECHARGE then ACTIVATE first: about 30 ns more.' },
  ],
  edges: [
    { from: 'rdec', to: 'cells', label: 'word line' },
    { from: 'cells', to: 'sa', label: 'bit lines' },
    { from: 'sa', to: 'buf' },
    { from: 'buf', to: 'cdec' },
  ],
});
