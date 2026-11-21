/** Level 2 (GPU): one compute unit (SM / CU). */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [
    { id: 'q', label: '4 quadrants, each:', tone: 'violet' },
    { id: 'shared', label: 'Shared by the unit', tone: 'sky' },
  ],
  nodes: [
    { id: 'ws', label: 'Warp scheduler', detail: 'picks a ready warp each cycle', parent: 'q', tone: 'violet', info: 'A warp (NVIDIA) or wavefront (AMD) is 32 or 64 threads that run the same instruction together. Switching warps costs nothing, so waiting for memory is hidden by running another warp. See [threads and wavefronts](/learn/gpu-execution-model/).' },
    { id: 'lanes', label: '32 lanes', detail: 'FP32 / INT32 math', parent: 'q', tone: 'violet' },
    { id: 'tc', label: 'Tensor core', detail: 'small matrix multiply per step', parent: 'q', tone: 'pink' },
    { id: 'rf', label: 'Register file', detail: '64 KB', shape: 'store', parent: 'q', tone: 'violet' },
    { id: 'smem', label: 'Shared memory / L1', detail: '128–256 KB', shape: 'store', parent: 'shared', tone: 'sky' },
    { id: 'ldst', label: 'Load / store + texture', detail: 'to L2 and VRAM', parent: 'shared', tone: 'sky' },
  ],
  edges: [
    { from: 'ws', to: 'lanes' },
    { from: 'ws', to: 'tc' },
    { from: 'rf', to: 'smem', arrow: 'both' },
    { from: 'smem', to: 'ldst', arrow: 'both' },
  ],
});
