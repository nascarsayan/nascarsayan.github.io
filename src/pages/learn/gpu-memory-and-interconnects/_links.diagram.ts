/** One 8-GPU MI355X server: each GPU shares a PCIe switch with one NIC; 8 GPUs in an XGMI hive; RoCE out. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'down',
  groups: [
    { id: 'srv', label: 'GPU server (example 8-GPU OAM server)', tone: 'muted' },
    { id: 'slice', label: 'One of 8 identical slices', tone: 'neutral', parent: 'srv' },
    { id: 'hive', label: 'XGMI hive (scale-up)', tone: 'sky', parent: 'srv' },
  ],
  nodes: [
    { id: 'cpu', label: 'CPU + host RAM', parent: 'srv', detail: '2 sockets, one NUMA node each' },
    { id: 'sw', label: 'PCIe Gen5 switch', parent: 'slice', detail: 'one per GPU' },
    { id: 'g0', label: 'GPU 0', parent: 'slice', detail: 'HBM 288 GB, 8 TB/s', tone: 'sky' },
    { id: 'nic', label: 'ConnectX-7 NIC', parent: 'slice', detail: '400 Gb/s RoCE', tone: 'teal' },
    { id: 'gn', label: 'GPUs 1–7', parent: 'hive', detail: 'each in its own slice' },
    { id: 'net', label: 'Data network', shape: 'external', detail: 'leaf / spine (scale-out)', side: 1 },
  ],
  edges: [
    { from: 'sw', to: 'cpu', label: 'PCIe x16' },
    { from: 'sw', to: 'g0', label: 'x16' },
    { from: 'sw', to: 'nic', label: 'x16' },
    { from: 'g0', to: 'gn', label: '7 XGMI links, 72 GB/s each way', arrow: 'both' },
    { from: 'nic', to: 'net', label: 'RoCE: KV cache to other servers' },
  ],
});
