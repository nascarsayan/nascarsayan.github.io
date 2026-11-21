/** One torch.matmul on MI355X, from Python to the command processor. Setup (queue creation) happened earlier, once per process. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'torch', label: 'PyTorch', detail: 'in the image', tone: 'primary' },
    { id: 'blas', label: 'hipBLASLt', detail: 'in the image', tone: 'primary' },
    { id: 'hip', label: 'HIP + ROCr', detail: 'in the image', tone: 'teal' },
    { id: 'ring', label: 'Queue ring', detail: 'memory, mapped to GPU', tone: 'muted' },
    { id: 'cp', label: 'Command processor', detail: 'on the GPU', tone: 'pink' },
    { id: 'cu', label: '256 CUs', detail: '8 XCDs', tone: 'sky' },
  ],
  messages: [
    { from: 'torch', to: 'blas', label: 'GEMM 4085×2880 · 2880×4096, BF16' },
    { from: 'blas', to: 'blas', label: 'pick a kernel for this shape on gfx950' },
    { from: 'blas', to: 'hip', label: 'launch: code object, grid, args' },
    { from: 'hip', to: 'ring', label: 'write 64-byte AQL packet in next slot' },
    { from: 'hip', to: 'cp', label: 'doorbell: one memory write, no syscall', tone: 'good' },
    { from: 'cp', to: 'ring', label: 'read the packet' },
    { from: 'cp', to: 'cu', label: '256 workgroups, round-robin over XCDs' },
    { from: 'cu', to: 'cp', label: 'all workgroups done' },
    { from: 'cp', to: 'hip', label: 'completion signal decremented in memory', tone: 'good' },
  ],
  frames: [
    { label: 'Host CPU, user space', from: 'm1', to: 'm5', tone: 'primary' },
    { label: 'GPU', from: 'm6', to: 'm9', tone: 'pink' },
  ],
});
