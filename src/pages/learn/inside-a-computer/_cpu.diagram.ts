/** Level 1: inside the CPU package. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [
    { id: 'cores', label: 'Cores', tone: 'primary', direction: 'right' },
    { id: 'uncore', label: 'Shared by all cores', tone: 'sky' },
  ],
  nodes: [
    { id: 'core0', label: 'Core 0', detail: 'runs one program thread', parent: 'cores', tone: 'primary' },
    { id: 'coren', label: 'Cores 1–7', detail: 'the same, 7 more', parent: 'cores', tone: 'primary' },
    { id: 'l3', label: 'L3 cache', detail: '32 MB, shared', shape: 'store', parent: 'uncore', tone: 'sky', info: 'The last and largest cache on the chip. A miss here means a trip to RAM: about 80 ns, or 350 clock cycles at 4.5 GHz.' },
    { id: 'ring', label: 'Interconnect', detail: 'ring or mesh between cores', parent: 'uncore', tone: 'sky', info: 'Wires that carry cache lines between the cores, the L3 slices and the controllers. It also keeps the caches *coherent*: when one core writes a line, other cores\' copies are invalidated.' },
    { id: 'imc', label: 'Memory controller', detail: 'schedules DRAM reads/writes', parent: 'uncore', tone: 'sky', info: 'Turns "read 64 bytes at address X" into DRAM commands (activate row, read column, precharge) and keeps every chip refreshed.' },
    { id: 'pcie', label: 'PCIe root complex', detail: '24 lanes', parent: 'uncore', tone: 'sky', info: 'Where PCIe devices (GPU, SSD, chipset) connect. Devices can also read and write RAM directly through it (DMA), without the cores copying the data.' },
    { id: 'smu', label: 'Power manager', detail: 'clocks, voltages, temps', parent: 'uncore', tone: 'muted', info: 'A small microcontroller inside the CPU. It raises the clock when there is power and thermal room, and lowers it (or parks cores) when there is not.' },
  ],
  edges: [
    { from: 'core0', to: 'ring', arrow: 'both' },
    { from: 'coren', to: 'ring', arrow: 'both' },
    { from: 'ring', to: 'l3', arrow: 'both' },
    { from: 'ring', to: 'imc', arrow: 'both' },
    { from: 'ring', to: 'pcie', arrow: 'both' },
    { from: 'smu', to: 'ring', style: 'dashed', label: 'clock, voltage' },
  ],
});
