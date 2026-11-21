/** Level 5: a one-bit full adder from five logic gates. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  wires: 'nets',
  groups: [
    { id: 'in', label: 'Inputs (bits)', tone: 'muted' },
    { id: 'g1', label: 'First gates', tone: 'good' },
    { id: 'g2', label: 'Second gates', tone: 'good' },
    { id: 'out', label: 'Outputs', tone: 'muted' },
  ],
  nodes: [
    { id: 'a', label: 'A', shape: 'pill', parent: 'in' },
    { id: 'b', label: 'B', shape: 'pill', parent: 'in' },
    { id: 'cin', label: 'Carry in', shape: 'pill', parent: 'in' },
    { id: 'x1', label: 'XOR', detail: 'A ⊕ B', parent: 'g1', tone: 'good' },
    { id: 'and1', label: 'AND', detail: 'A · B', parent: 'g1', tone: 'good', info: 'Output 1 only when both inputs are 1. Here: A and B are both 1, so there is a carry whatever the carry in is.' },
    { id: 'x2', label: 'XOR', detail: '(A ⊕ B) ⊕ Cin', parent: 'g2', tone: 'good' },
    { id: 'and2', label: 'AND', detail: '(A ⊕ B) · Cin', parent: 'g2', tone: 'good' },
    { id: 'or', label: 'OR', detail: 'either AND', parent: 'g2', tone: 'good' },
    { id: 's', label: 'Sum', shape: 'pill', parent: 'out' },
    { id: 'cout', label: 'Carry out', shape: 'pill', parent: 'out' },
  ],
  edges: [
    { from: 'a', to: 'x1' },
    { from: 'b', to: 'x1' },
    { from: 'a', to: 'and1' },
    { from: 'b', to: 'and1' },
    { from: 'x1', to: 'x2' },
    { from: 'x1', to: 'and2' },
    { from: 'cin', to: 'x2' },
    { from: 'cin', to: 'and2' },
    { from: 'and1', to: 'or' },
    { from: 'and2', to: 'or' },
    { from: 'x2', to: 's' },
    { from: 'or', to: 'cout' },
  ],
});
