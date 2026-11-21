/** GEMM tiling levels: output matrix to workgroup tile to wave tile to one MFMA. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'hbm', label: 'HBM', tone: 'peach' },
    { id: 'cu', label: 'One CU', tone: 'lime' },
    { id: 'simd', label: 'One SIMD', tone: 'sky' },
  ],
  nodes: [
    { id: 'c', label: 'C = A·B', parent: 'hbm', detail: 'M × N output', info: 'Split into workgroup tiles; one workgroup per tile. A 8192 × 8192 output with 256 × 256 tiles is 1,024 workgroups.' },
    { id: 'ab', label: 'A and B', parent: 'hbm', shape: 'store', detail: 'read once per tile row / column' },
    { id: 'wg', label: 'Workgroup tile', parent: 'cu', detail: '256 × 256, K-step 64', info: 'Each K-step copies a 256 × 64 slice of A and a 64 × 256 slice of B into LDS: 64 KB in BF16, 128 KB double-buffered.' },
    { id: 'lds', label: 'LDS', parent: 'cu', shape: 'store', detail: 'A and B slices', tone: 'lime' },
    { id: 'wave', label: 'Wave tile', parent: 'simd', detail: '128 × 128 per wavefront', info: '4 wavefronts split the 256 × 256 tile. 128 × 128 FP32 results = 16 MFMA tiles of 32 × 32 = 256 accumulator registers per lane.' },
    { id: 'mfma', label: 'v_mfma 32×32×16', parent: 'simd', detail: 'accumulates in AGPRs', tone: 'good' },
  ],
  edges: [
    { from: 'c', to: 'wg', label: 'one tile per workgroup' },
    { from: 'ab', to: 'lds', label: 'global_load → ds_write' },
    { from: 'wg', to: 'wave', label: 'split over 4 waves' },
    { from: 'lds', to: 'mfma', label: 'ds_read' },
    { from: 'wave', to: 'mfma', label: '16 tiles each' },
  ],
});
