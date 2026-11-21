/** A 64-bit adder built from 64 one-bit full adders (ripple carry). */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [{ id: 'chain', label: 'One full adder per bit, carry passed along', tone: 'good', direction: 'right' }],
  nodes: [
    { id: 'fa0', label: 'Full adder 0', detail: 'A0 + B0', parent: 'chain', tone: 'good', info: 'Bit 0, the lowest bit. Each full adder adds two bits and a carry, and passes its own carry to the next bit. Real CPUs compute the carries in parallel (carry-lookahead) instead of waiting 64 steps; the full adders are the same.' },
    { id: 'fa1', label: 'Full adder 1', detail: 'A1 + B1 + carry', parent: 'chain', tone: 'good' },
    { id: 'more', label: '… 61 more …', parent: 'chain', tone: 'muted' },
    { id: 'fa63', label: 'Full adder 63', detail: 'A63 + B63 + carry', parent: 'chain', tone: 'good' },
    { id: 'cout', label: 'Carry out', detail: 'sets the carry flag', shape: 'pill', tone: 'warn', side: 1 },
    { id: 'sum', label: 'Sum: 64 bits', detail: 'one bit from each adder', shape: 'pill', band: 1 },
  ],
  edges: [
    { from: 'fa0', to: 'fa1', label: 'carry' },
    { from: 'fa1', to: 'more', label: 'carry' },
    { from: 'more', to: 'fa63', label: 'carry' },
    { from: 'fa63', to: 'cout' },
    { from: 'fa0', to: 'sum', style: 'dashed' },
    { from: 'fa63', to: 'sum', style: 'dashed' },
  ],
});
