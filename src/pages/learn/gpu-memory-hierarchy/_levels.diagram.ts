/** MI355X memory levels from a lane's registers out to HBM and peer GPUs. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'cu', label: 'Inside one CU (×256)', tone: 'lime' },
    { id: 'xcd', label: 'Per XCD (×8)', tone: 'sky' },
    { id: 'pkg', label: 'Whole GPU package', tone: 'peach' },
  ],
  nodes: [
    { id: 'reg', label: 'Registers', parent: 'cu', detail: '512 KB VGPR + SGPRs', info: '128 KB per SIMD. Every resident wave keeps its v and a registers here. Across 256 CUs that is 128 MB, more than all the L2.' },
    { id: 'lds', label: 'LDS', parent: 'cu', detail: '160 KB, software managed', info: 'Shared by one workgroup. 64 banks of 4 bytes (CDNA4 ISA guide). Kernels stage tiles here explicitly with ds_write / ds_read.' },
    { id: 'l1', label: 'L1 vector cache', parent: 'cu', detail: '32 KB', info: 'Hardware-managed cache for global_ and buffer_ loads. Scalar loads use a separate 16 KB cache shared by 2 CUs.' },
    { id: 'l2', label: 'L2', parent: 'xcd', detail: '4 MB per XCD', info: 'Shared by the 32 CUs of one XCD. Workgroups are spread round-robin over XCDs in SPX mode, so neighbours often sit on different L2s.' },
    { id: 'mall', label: 'Infinity Cache', parent: 'pkg', detail: '256 MB, all XCDs', info: 'Also called MALL or last-level cache; rocminfo reports it as L3.' },
    { id: 'hbm', label: 'HBM3E', parent: 'pkg', shape: 'store', detail: '288 GB · ~8 TB/s', tone: 'warn' },
    { id: 'peer', label: 'Other GPUs', parent: 'pkg', shape: 'external', detail: 'Infinity Fabric links', info: '7 links per GPU, 144 GB/s peak each (AMD spec). Covered on the memory and interconnects page.' },
  ],
  edges: [
    { from: 'reg', to: 'lds', arrow: 'both', label: 'ds_read / ds_write' },
    { from: 'reg', to: 'l1', arrow: 'both', label: 'global_load' },
    { from: 'l1', to: 'l2', arrow: 'both' },
    { from: 'l2', to: 'mall', arrow: 'both' },
    { from: 'mall', to: 'hbm', arrow: 'both' },
    { from: 'hbm', to: 'peer', arrow: 'both', style: 'dashed' },
  ],
});
