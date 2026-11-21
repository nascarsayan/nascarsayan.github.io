/** Level 1: a key press, from switch to program. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'kb', label: 'In the keyboard', tone: 'peach' },
    { id: 'host', label: 'In the computer', tone: 'teal' },
  ],
  nodes: [
    { id: 'sw', label: 'Key switch', detail: 'closes a contact', parent: 'kb', tone: 'peach' },
    { id: 'matrix', label: 'Key matrix', detail: '6 rows × 18 columns of wires', parent: 'kb', tone: 'peach', info: 'Each key joins one row wire to one column wire. 108 keys need only 24 wires instead of 108.' },
    { id: 'mcu', label: 'Microcontroller', detail: 'scans rows 1000×/s, debounces', parent: 'kb', tone: 'peach', info: 'It drives one row at a time and reads which columns light up. A contact bounces for a few ms, so it waits for a stable reading before reporting.' },
    { id: 'report', label: 'USB HID report', detail: 'key code 0x04 = "A" pressed', parent: 'kb', tone: 'peach' },
    { id: 'xhci', label: 'USB controller', detail: 'polls every 1 ms', parent: 'host', tone: 'teal' },
    { id: 'drv', label: 'OS keyboard driver', detail: 'key code → character', parent: 'host', tone: 'teal' },
    { id: 'app', label: 'Your program', detail: 'gets a key event', parent: 'host', tone: 'teal' },
  ],
  edges: [
    { from: 'sw', to: 'matrix' },
    { from: 'matrix', to: 'mcu' },
    { from: 'mcu', to: 'report' },
    { from: 'report', to: 'xhci', label: 'cable' },
    { from: 'xhci', to: 'drv', label: 'interrupt' },
    { from: 'drv', to: 'app' },
  ],
});
