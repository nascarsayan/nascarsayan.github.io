/** Level 1: a microphone, from sound wave to numbers in RAM. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'an', label: 'Analog', tone: 'peach' },
    { id: 'dig', label: 'Digital', tone: 'teal' },
  ],
  nodes: [
    { id: 'wave', label: 'Sound wave', detail: 'air pressure going up and down', parent: 'an', tone: 'peach' },
    { id: 'mems', label: 'MEMS diaphragm', detail: 'moves; capacitance changes', parent: 'an', tone: 'peach', info: 'A silicon membrane about 1 mm wide over a fixed plate. Its movement changes the capacitance between them, which becomes a tiny voltage.' },
    { id: 'amp', label: 'Preamplifier', detail: 'millivolts → volts', parent: 'an', tone: 'peach' },
    { id: 'adc', label: 'ADC', detail: '48 000 samples/s, 24 bits', parent: 'dig', tone: 'teal', info: 'Analog-to-digital converter: measures the voltage 48 000 times a second and writes each measurement as a number.' },
    { id: 'codec', label: 'Audio codec', detail: 'on the board', parent: 'dig', tone: 'teal' },
    { id: 'dma', label: 'DMA into RAM', detail: 'a ring buffer the OS reads', shape: 'store', parent: 'dig', tone: 'teal' },
  ],
  edges: [
    { from: 'wave', to: 'mems' },
    { from: 'mems', to: 'amp' },
    { from: 'amp', to: 'adc' },
    { from: 'adc', to: 'codec' },
    { from: 'codec', to: 'dma', label: 'HD Audio' },
  ],
});
