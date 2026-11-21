/** Level 1: a switching power supply. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'pri', label: 'High-voltage side', tone: 'risk' },
    { id: 'sec', label: 'Low-voltage side', tone: 'warn' },
  ],
  nodes: [
    { id: 'ac', label: 'Wall AC', detail: '230 V, 50 Hz', parent: 'pri', tone: 'risk' },
    { id: 'rect', label: 'Rectifier + PFC', detail: 'AC → ~400 V DC', parent: 'pri', tone: 'risk', info: 'Power-factor correction draws current in step with the mains voltage, so the supply does not distort the grid.' },
    { id: 'sw', label: 'Switching MOSFETs', detail: 'chop at ~100 kHz', parent: 'pri', tone: 'risk', info: 'Switching fast lets a small transformer do the job of a heavy 50 Hz one.' },
    { id: 'xf', label: 'Transformer', detail: 'steps down, isolates', parent: 'sec', tone: 'warn' },
    { id: 'out', label: 'Rectify + filter', detail: '12 V, 5 V, 3.3 V', parent: 'sec', tone: 'warn' },
    { id: 'vrm', label: 'VRM on the board', detail: '12 V → 1.1 V for the cores', parent: 'sec', tone: 'warn', info: 'Voltage regulator module: several phases of buck converters next to the CPU socket, delivering up to 200 A at the voltage the CPU asks for.' },
  ],
  edges: [
    { from: 'ac', to: 'rect' },
    { from: 'rect', to: 'sw' },
    { from: 'sw', to: 'xf' },
    { from: 'xf', to: 'out' },
    { from: 'out', to: 'vrm' },
  ],
});
