/** Start order on an HGX/DGX node with NVSwitch: what must be up before a CUDA program can start. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  nodes: [
    { id: 'drv', label: 'NVIDIA driver + GSP', detail: 'e.g. 570.00.00 (example)', tone: 'violet' },
    { id: 'fm', label: 'Fabric Manager', detail: 'nvidia-fabricmanager', tone: 'primary', info: 'Checks the driver stack at start and aborts on an incompatible version. Log: /var/log/fabricmanager.log.' },
    { id: 'lsm', label: 'NVLSM', detail: 'B200/B300: subnet manager', info: 'NVLink subnet manager, a Fabric Manager dependency on B200/B300. Log: /var/log/opensm.log.' },
    { id: 'sw', label: 'NVSwitch chips', detail: 'GPU-to-GPU routing', shape: 'store' },
    { id: 'gpus', label: '8 GPUs', detail: 'listed by nvidia-smi either way', shape: 'external', tone: 'peach' },
    { id: 'app', label: 'CUDA program', detail: 'vLLM, NCCL tests', tone: 'pink' },
  ],
  edges: [
    { from: 'fm', to: 'drv', label: 'version check' },
    { from: 'fm', to: 'lsm' },
    { from: 'fm', to: 'sw', label: 'program routes' },
    { from: 'sw', to: 'gpus' },
    { from: 'app', to: 'gpus', label: 'cudaInit' },
  ],
});
