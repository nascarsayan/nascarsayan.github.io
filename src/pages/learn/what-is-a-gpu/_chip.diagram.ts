/** One MI355X package: 8 XCDs stacked on 2 IODs, Infinity Cache, 8 HBM3E stacks, PCIe and Infinity Fabric I/O. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  // Columns: one per IOD with its HBM stacks; host and peers as strips at the sides.
  layout: 'columns',
  groups: [
    { id: 'iod0', label: 'IOD 0 and its HBM', tone: 'primary', direction: 'down' },
    { id: 'iod1', label: 'IOD 1 and its HBM', tone: 'primary', direction: 'down' },
  ],
  nodes: [
    { id: 'cpu', label: 'CPU + RAM', side: -1, detail: 'the host: runs your program' },
    { id: 'x0', label: '4 XCDs', parent: 'iod0', detail: '128 CUs', info: 'Each XCD (accelerator complex die, TSMC N3P) has 36 CUs, 32 enabled, and a 4 MB L2. XCDs are stacked on top of the IOD.' },
    { id: 'c0', label: 'Infinity Cache', parent: 'iod0', detail: '128 MB', info: 'Memory-side last-level cache: 256 MB across both IODs. Each IOD (I/O die, TSMC N6) has four HBM memory controllers.' },
    { id: 'h0', label: '4 HBM3E stacks', parent: 'iod0', shape: 'store', detail: '4 × 36 GB', info: 'Beside the IODs on the same package, wired to this IOD\'s four memory controllers.' },
    { id: 'x1', label: '4 XCDs', parent: 'iod1', detail: '128 CUs' },
    { id: 'c1', label: 'Infinity Cache', parent: 'iod1', detail: '128 MB' },
    { id: 'h1', label: '4 HBM3E stacks', parent: 'iod1', shape: 'store', detail: '4 × 36 GB' },
    { id: 'io', label: 'I/O', parent: 'iod1', detail: 'PCIe + Infinity Fabric links', info: 'Eight 16-bit Infinity Fabric links per GPU, four per IOD. On 8-GPU servers seven go to the other GPUs and one is configured as PCIe Gen5 x16 to the host.' },
    { id: 'peers', label: '7 other GPUs', shape: 'external', side: 1, detail: 'XGMI', tone: 'teal' },
  ],
  edges: [
    { from: 'cpu', to: 'io', label: 'PCIe Gen5 x16' },
    { from: 'io', to: 'peers', label: '7 × XGMI', arrow: 'both' },
    { from: 'x0', to: 'c0', arrow: 'both' },
    { from: 'c0', to: 'h0', arrow: 'both' },
    { from: 'x1', to: 'c1', arrow: 'both' },
    { from: 'c1', to: 'h1', arrow: 'both' },
    { from: 'c0', to: 'c1', label: 'IOD-to-IOD', arrow: 'both' },
    { from: 'io', to: 'c1', arrow: 'both' },
  ],
});
