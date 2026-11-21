/** Intuition: one launch fans out into blocks, waves and lanes on an MI355X. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [
    { id: 'sw', label: 'What the code asks for', tone: 'muted', direction: 'right' },
    { id: 'hw', label: 'Where it runs (MI355X)', tone: 'muted', direction: 'right' },
  ],
  nodes: [
    { id: 'launch', parent: 'sw', label: 'One kernel launch', detail: 'axpy<<<3907, 256>>>', shape: 'external', info: 'The host asks for 3,907 blocks of 256 threads: about a million copies of one function.' },
    { id: 'grid', parent: 'sw', label: 'Grid', detail: '3,907 blocks', tone: 'sky', info: 'The work order: every block is independent, so the GPU may run them in any order, on any CU.' },
    { id: 'block', parent: 'sw', label: 'Block (workgroup)', detail: '256 threads = 4 waves', tone: 'teal', info: 'Lands on one CU and stays there. Its threads can share LDS and wait for each other at barriers.' },
    { id: 'cu', parent: 'hw', label: 'CU', detail: '1 of 256 · 160 KB LDS', tone: 'primary', info: 'The compute unit: 4 SIMDs, a register file, LDS and an L1 cache.' },
    { id: 'simd', parent: 'hw', label: 'SIMD', detail: '1 of 4 · up to 8 waves', tone: 'violet', info: 'One vector unit with 16 lanes. It keeps up to 8 waves resident and issues for one of them at a time.' },
    { id: 'wave', parent: 'hw', label: 'Wavefront', detail: '64 threads, one instruction', tone: 'pink', info: 'The real unit of execution: 64 threads that share one program counter and an EXEC mask.' },
    { id: 'lane', parent: 'hw', label: 'Lane', detail: 'one thread: i = 0 … 63', tone: 'peach', info: 'One thread. It has its own registers (VGPRs) and its own index, and nothing else.' },
  ],
  edges: [
    { from: 'launch', to: 'grid', label: 'split into' },
    { from: 'grid', to: 'block', label: 'one of' },
    { from: 'block', to: 'cu', label: 'placed on' },
    { from: 'cu', to: 'simd', label: 'waves spread over' },
    { from: 'simd', to: 'wave', label: 'issues for' },
    { from: 'wave', to: 'lane', label: '× 64' },
  ],
});
