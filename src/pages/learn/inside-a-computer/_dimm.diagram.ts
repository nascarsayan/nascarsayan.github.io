/** Level 1: a DDR5 memory stick. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [
    { id: 'a', label: 'Subchannel A (32 bits)', tone: 'primary', direction: 'right' },
    { id: 'b', label: 'Subchannel B (32 bits)', tone: 'primary', direction: 'right' },
  ],
  nodes: [
    { id: 'imc', label: 'Memory controller', detail: 'in the CPU', band: -1, tone: 'sky' },
    { id: 'chip', label: 'DRAM chip', detail: '16 Gbit, 8 bits wide', parent: 'a', tone: 'primary' },
    { id: 'chips', label: '3 more chips', detail: 'same address, other bits', parent: 'a', tone: 'primary' },
    { id: 'chipb', label: '4 DRAM chips', detail: 'the other half', parent: 'b', tone: 'primary' },
    { id: 'pmic', label: 'PMIC', detail: 'power for the stick', band: 1, tone: 'warn', info: 'DDR5 moved the voltage regulator onto the stick itself. Next to it is a tiny EEPROM (SPD) that tells the firmware the stick\'s size and timings at boot.' },
  ],
  edges: [
    { from: 'imc', to: 'chip', label: 'commands + data', arrow: 'both' },
    { from: 'imc', to: 'chipb', arrow: 'both' },
  ],
});
