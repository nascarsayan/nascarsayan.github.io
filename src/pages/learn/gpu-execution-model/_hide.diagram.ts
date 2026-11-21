/** One SIMD hides memory latency by switching between resident wavefronts. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'w0', label: 'Wave 0', tone: 'sky' },
    { id: 'w1', label: 'Wave 1', tone: 'teal' },
    { id: 'simd', label: 'SIMD + scheduler', tone: 'primary' },
    { id: 'mem', label: 'L2 / HBM', tone: 'muted' },
  ],
  messages: [
    { from: 'w0', to: 'simd', label: 'global_load_dwordx4' },
    { from: 'simd', to: 'mem', label: 'request 1 KB (64 lanes × 16 B)' },
    { from: 'w0', to: 'simd', label: 's_waitcnt vmcnt(0): not ready, wave 0 sleeps', tone: 'warn' },
    { from: 'w1', to: 'simd', label: 'v_fmac, v_mfma … (has its data)', tone: 'good' },
    { from: 'w1', to: 'simd', label: 'global_load: wave 1 sleeps too', tone: 'warn' },
    { from: 'mem', to: 'simd', label: 'wave 0 data arrives (hundreds of ns later)', style: 'dashed' },
    { from: 'simd', to: 'w0', label: 'wave 0 runs again', tone: 'good' },
  ],
  frames: [
    { label: 'Latency hidden by other waves', from: 'm3', to: 'm6', tone: 'note' },
  ],
});
