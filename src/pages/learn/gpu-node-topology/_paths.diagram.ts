/** Three NICs for GPU 5 on the illustrative MI355X node: same switch, same socket other root, other socket. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'down',
  groups: [
    { id: 's1', label: 'CPU 1 (PCI buses 80–ff)', tone: 'muted' },
    { id: 's0', label: 'CPU 0 (PCI buses 00–7f)', tone: 'muted' },
  ],
  nodes: [
    { id: 'cpu1', label: 'CPU 1 I/O fabric', parent: 's1', detail: 'NUMA 1' },
    { id: 'sw5', label: 'Switch, root pci0000:a0', parent: 's1', detail: 'NUMA 1' },
    { id: 'g5', label: 'GPU 5', parent: 's1', detail: '0000:a9:00.0', tone: 'sky' },
    { id: 'n5', label: 'rdma5', parent: 's1', detail: 'ens6np0', tone: 'teal' },
    { id: 'sw4', label: 'Switch, root pci0000:80', parent: 's1', detail: 'NUMA 1' },
    { id: 'n4', label: 'rdma4', parent: 's1', detail: 'ens5np0', tone: 'teal' },
    { id: 'cpu0', label: 'CPU 0 I/O fabric', parent: 's0', detail: 'NUMA 0' },
    { id: 'sw0', label: 'Switch, root pci0000:00', parent: 's0', detail: 'NUMA 0' },
    { id: 'n0', label: 'rdma0', parent: 's0', detail: 'ens1np0', tone: 'teal' },
  ],
  edges: [
    { from: 'cpu1', to: 'sw5', label: 'x16' },
    { from: 'sw5', to: 'g5', label: 'x16' },
    { from: 'sw5', to: 'n5', label: 'x16' },
    { from: 'cpu1', to: 'sw4', label: 'x16' },
    { from: 'sw4', to: 'n4', label: 'x16' },
    { from: 'cpu1', to: 'cpu0', label: 'socket-to-socket link', arrow: 'both' },
    { from: 'cpu0', to: 'sw0', label: 'x16' },
    { from: 'sw0', to: 'n0', label: 'x16' },
  ],
});
