/** Level 3: one integer ALU. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'in', label: 'Input', tone: 'muted' },
    { id: 'units', label: 'All circuits work at once', tone: 'good' },
    { id: 'out', label: 'Output', tone: 'muted' },
  ],
  nodes: [
    { id: 'ab', label: 'Operands A, B', detail: '64 bits each, from registers', parent: 'in' },
    { id: 'add', label: 'Adder', detail: 'A + B, A − B', parent: 'units', tone: 'good', info: 'Subtraction is addition: A − B = A + (NOT B) + 1 (two\'s complement), so one adder does both.' },
    { id: 'logic', label: 'Logic unit', detail: 'AND, OR, XOR, NOT', parent: 'units', tone: 'good' },
    { id: 'shift', label: 'Shifter', detail: 'A << n, A >> n', parent: 'units', tone: 'good' },
    { id: 'op', label: 'Opcode', detail: 'which result to keep', parent: 'out', tone: 'warn' },
    { id: 'mux', label: 'Multiplexer', detail: 'picks one result', parent: 'out', tone: 'warn', info: 'All circuits compute every cycle; the opcode only selects which answer goes out. Hardware is cheaper than waiting.' },
    { id: 'res', label: 'Result + flags', detail: 'zero, carry, sign, overflow', parent: 'out' },
  ],
  edges: [
    { from: 'ab', to: 'add' },
    { from: 'ab', to: 'logic' },
    { from: 'ab', to: 'shift' },
    { from: 'add', to: 'mux' },
    { from: 'logic', to: 'mux' },
    { from: 'shift', to: 'mux' },
    { from: 'op', to: 'mux', style: 'dashed', tone: 'warn', label: 'select' },
    { from: 'mux', to: 'res' },
  ],
});
