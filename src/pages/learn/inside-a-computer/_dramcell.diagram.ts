/** Level 4 (RAM): one DRAM bit: one transistor and one capacitor. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [{ id: 'cell', label: 'One bit', tone: 'primary', direction: 'right' }],
  nodes: [
    { id: 'wl', label: 'Word line', detail: 'from the row decoder', shape: 'pill', band: -1, tone: 'warn' },
    { id: 'bl', label: 'Bit line', detail: 'to the sense amplifier', parent: 'cell' },
    { id: 't', label: 'Transistor', detail: 'the door', parent: 'cell', tone: 'teal' },
    { id: 'c', label: 'Capacitor', detail: 'charged = 1, empty = 0', shape: 'store', parent: 'cell', tone: 'primary', info: 'A few femtofarads: about 40 000 electrons. It leaks, so every row is read and rewritten every 32 ms (refresh). Small cell, so DRAM is dense and cheap, but slower than SRAM.' },
  ],
  edges: [
    { from: 'wl', to: 't', label: 'opens', style: 'dashed', tone: 'warn' },
    { from: 'bl', to: 't', arrow: 'both' },
    { from: 't', to: 'c', arrow: 'both', label: 'charge' },
  ],
});
