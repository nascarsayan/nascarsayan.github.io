/** The loop that joins a GPU to its Pod and back (example node gpu-node-1, GPU 4). */
import { defineDiagram } from '@/diagrams/spec';
import { pids, bdf, oam, pod, device } from './_trace';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  groups: [
    { id: 'node', label: 'On the GPU node', tone: 'peach' },
    { id: 'api', label: 'In the Kubernetes API', tone: 'primary' },
  ],
  nodes: [
    { id: 'gpu', label: 'GPU index 4', parent: 'node', detail: 'amd-smi' },
    { id: 'pid', label: 'Host PIDs', parent: 'node', detail: pids.join(', ') },
    { id: 'cg', label: 'cgroup path', parent: 'node', detail: 'pod UID + container ID', shape: 'note' },
    { id: 'bdf', label: 'PCI BDF', parent: 'node', detail: bdf },
    { id: 'slot', label: `OAM slot ${oam}`, parent: 'node', detail: 'board serial', tone: 'peach' },
    { id: 'pod', label: 'Pod', parent: 'api', detail: `llm-prefill-…-${pod.split('-').at(-1)}` },
    { id: 'claim', label: 'ResourceClaim', parent: 'api', detail: 'the allocation ledger', tone: 'note' },
    { id: 'dev', label: 'DRA device', parent: 'api', detail: `${device} in the ResourceSlice` },
  ],
  edges: [
    { from: 'gpu', to: 'pid', label: 'amd-smi process' },
    { from: 'pid', to: 'cg', label: '/proc/PID/cgroup' },
    { from: 'cg', to: 'pod', label: 'Pod UID' },
    { from: 'pod', to: 'claim', label: 'resourceClaimStatuses' },
    { from: 'claim', to: 'dev', label: 'status.allocation' },
    { from: 'dev', to: 'bdf', label: 'pciBusID' },
    { from: 'bdf', to: 'gpu', label: 'amd-smi list -e' },
    { from: 'bdf', to: 'slot' },
  ],
});
