/** Level 1: an NVMe SSD. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'front', label: 'Controller: host side', tone: 'violet' },
    { id: 'back', label: 'Controller: flash side', tone: 'violet' },
    { id: 'flash', label: '8 channels of flash', tone: 'primary' },
  ],
  nodes: [
    { id: 'host', label: 'PCIe / NVMe interface', detail: '64K queues to the CPU', parent: 'front', tone: 'violet' },
    { id: 'fw', label: 'Arm cores: FTL firmware', detail: 'logical → physical map', parent: 'front', tone: 'violet', info: 'Flash cannot overwrite in place, so the flash translation layer (FTL) writes new data elsewhere, keeps a map, wears all blocks evenly and garbage-collects old blocks.' },
    { id: 'dram', label: 'DRAM cache', detail: '1 GB: the map', shape: 'store', parent: 'back', tone: 'muted' },
    { id: 'ecc', label: 'ECC engine', detail: 'LDPC error correction', parent: 'back', tone: 'violet' },
    { id: 'nand', label: 'NAND package', detail: '4 dies × 1 Tbit', shape: 'store', parent: 'flash', tone: 'primary' },
    { id: 'more', label: '7 more channels', detail: 'read in parallel', parent: 'flash', tone: 'primary' },
  ],
  edges: [
    { from: 'host', to: 'fw' },
    { from: 'fw', to: 'dram', arrow: 'both' },
    { from: 'fw', to: 'ecc' },
    { from: 'ecc', to: 'nand', arrow: 'both', label: 'channel 0' },
  ],
});
