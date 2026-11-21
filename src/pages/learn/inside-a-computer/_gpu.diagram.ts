/** Level 1: a graphics card. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [
    { id: 'die', label: 'GPU chip', tone: 'violet' },
    { id: 'board', label: 'On the card', tone: 'muted' },
  ],
  nodes: [
    { id: 'cp', label: 'Command processor', detail: 'reads work the CPU queued', parent: 'die', tone: 'violet' },
    { id: 'sm', label: 'Compute units', detail: '80 × 128 lanes', parent: 'die', tone: 'violet', info: 'NVIDIA calls them SMs (streaming multiprocessors), AMD calls them CUs. Each runs thousands of threads at once.' },
    { id: 'l2', label: 'L2 cache', detail: '64 MB, shared', shape: 'store', parent: 'die', tone: 'violet' },
    { id: 'mc', label: 'Memory controllers', detail: '8 × 32-bit', parent: 'die', tone: 'violet' },
    { id: 'disp', label: 'Display + video engines', detail: 'scan-out, encode, decode', parent: 'die', tone: 'violet' },
    { id: 'vram', label: 'VRAM', detail: '16 GB GDDR7', shape: 'store', parent: 'board', tone: 'primary', info: 'About 1 TB/s, ten times a desktop CPU\'s RAM, because the chips sit right next to the GPU on short, wide wires. Datacenter GPUs stack HBM on the package for even more.' },
    { id: 'vrm', label: 'VRMs', detail: '12 V → 1 V, 300 A', parent: 'board', tone: 'warn' },
    { id: 'edge', label: 'PCIe x16 connector', detail: 'to the CPU', parent: 'board' },
  ],
  edges: [
    { from: 'edge', to: 'cp' },
    { from: 'cp', to: 'sm', label: 'launches' },
    { from: 'sm', to: 'l2', arrow: 'both' },
    { from: 'l2', to: 'mc', arrow: 'both' },
    { from: 'mc', to: 'vram', arrow: 'both' },
  ],
});
