/** Two vendors' stacks for the AMD/NVIDIA explorer: which layer comes from the image and which from the host. */
import { defineDiagram } from '@/diagrams/spec';

export const amd = defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'ctr', label: 'Container image', tone: 'primary' },
    { id: 'host', label: 'Host, shared by all Pods', tone: 'muted' },
  ],
  nodes: [
    { id: 'fw', label: 'PyTorch (ROCm build), vLLM', parent: 'ctr' },
    { id: 'lib', label: 'hipBLASLt, RCCL, CK', parent: 'ctr' },
    { id: 'rt', label: 'HIP + ROCr runtime', parent: 'ctr', detail: 'opens /dev/kfd' },
    { id: 'dev', label: '/dev/kfd, renderD*', parent: 'host', detail: 'injected by CDI' },
    { id: 'kmod', label: 'amdgpu + KFD', parent: 'host', detail: 'DKMS module', tone: 'warn' },
    { id: 'fwr', label: 'IFWI on card + microcode package', parent: 'host', tone: 'warn' },
  ],
  edges: [
    { from: 'fw', to: 'lib' },
    { from: 'lib', to: 'rt' },
    { from: 'rt', to: 'dev', label: 'ioctl (setup only)' },
    { from: 'dev', to: 'kmod' },
    { from: 'kmod', to: 'fwr' },
  ],
});

export const nvidia = defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'ctr', label: 'Container image', tone: 'primary' },
    { id: 'mnt', label: 'Host files mounted in', tone: 'peach' },
    { id: 'host', label: 'Host, shared by all Pods', tone: 'muted' },
  ],
  nodes: [
    { id: 'fw', label: 'PyTorch (CUDA build), vLLM', parent: 'ctr' },
    { id: 'lib', label: 'cuBLASLt, NCCL, cuDNN', parent: 'ctr' },
    { id: 'rt', label: 'CUDA runtime libcudart', parent: 'ctr' },
    { id: 'cuda', label: 'libcuda.so, nvidia-smi', parent: 'mnt', detail: 'must match the kernel module' },
    { id: 'dev', label: '/dev/nvidia*', parent: 'host', detail: 'injected by CDI' },
    { id: 'kmod', label: 'nvidia open modules', parent: 'host', tone: 'warn' },
    { id: 'fwr', label: 'VBIOS + GSP firmware', parent: 'host', tone: 'warn' },
  ],
  edges: [
    { from: 'fw', to: 'lib' },
    { from: 'lib', to: 'rt' },
    { from: 'rt', to: 'cuda' },
    { from: 'cuda', to: 'dev' },
    { from: 'dev', to: 'kmod' },
    { from: 'kmod', to: 'fwr' },
  ],
});
