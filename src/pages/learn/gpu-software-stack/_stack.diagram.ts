/** GPU software layers; host vs container. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'ctr', label: 'Container image (per Pod)', tone: 'primary' },
    { id: 'host', label: 'Host (shared by all Pods)', tone: 'muted' },
  ],
  nodes: [
    { id: 'fw', label: 'Framework', parent: 'ctr', detail: 'PyTorch, vLLM' },
    { id: 'lib', label: 'Libraries', parent: 'ctr', detail: 'RCCL / NCCL, BLAS' },
    { id: 'rt', label: 'Runtime', parent: 'ctr', detail: 'ROCr + HIP · CUDA runtime' },
    { id: 'dev', label: 'Device files', parent: 'host', detail: '/dev/kfd, /dev/dri · /dev/nvidia*' },
    { id: 'kmod', label: 'Kernel driver', parent: 'host', detail: 'amdgpu + KFD (DKMS) · nvidia open modules', tone: 'warn' },
    { id: 'fwr', label: 'Firmware', parent: 'host', detail: 'IFWI on card + host microcode · VBIOS + GSP', tone: 'warn' },
  ],
  edges: [
    { from: 'fw', to: 'lib' },
    { from: 'lib', to: 'rt' },
    { from: 'rt', to: 'dev', label: 'ioctl' },
    { from: 'dev', to: 'kmod' },
    { from: 'kmod', to: 'fwr' },
  ],
});
