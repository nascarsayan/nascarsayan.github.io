/** Level 3 (SSD): one flash cell: trapped charge = stored bits. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'stack', label: 'The cell, top to bottom', tone: 'peach' },
    { id: 'levels', label: 'TLC: 8 charge levels', tone: 'primary' },
  ],
  nodes: [
    { id: 'cg', label: 'Control gate', detail: 'word line', parent: 'stack', tone: 'warn' },
    { id: 'trap', label: 'Charge-trap layer', detail: 'holds electrons for years', parent: 'stack', tone: 'peach', info: 'Programming pushes electrons through the insulator with a high voltage (about 20 V); they stay trapped with the power off. Each push wears the insulator a little.' },
    { id: 'ch', label: 'Channel', detail: 'part of a vertical string', parent: 'stack', tone: 'peach', info: '3D NAND stacks over 200 cell layers on top of each other, in vertical strings.' },
    { id: 'l0', label: '111 = erased', detail: 'no extra charge', parent: 'levels', tone: 'primary' },
    { id: 'lmid', label: '110 … 001', detail: '6 levels in between', parent: 'levels', tone: 'primary' },
    { id: 'l7', label: '000', detail: 'most charge', parent: 'levels', tone: 'primary', info: 'Reading compares the cell against 7 reference voltages to find which of the 8 levels it holds. Close levels are why TLC and QLC need strong ECC.' },
  ],
  edges: [
    { from: 'trap', to: 'lmid', label: 'amount of charge', style: 'dashed' },
  ],
});
