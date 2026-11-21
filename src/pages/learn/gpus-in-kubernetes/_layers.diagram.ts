/** The layers a GPU Pod passes through, used by the "where it breaks" explorer. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  groups: [{ id: 'gnode', label: 'GPU node', tone: 'muted' }],
  nodes: [
    { id: 'op', label: 'AMD GPU operator', detail: 'DeviceConfig → DaemonSets', tone: 'primary' },
    { id: 'api', label: 'API + scheduler', detail: 'slices, claims, binding', tone: 'note', shape: 'store' },
    { id: 'drv', label: 'DRA driver', detail: 'gpu.amd.com', parent: 'gnode', tone: 'teal' },
    { id: 'kubelet', label: 'kubelet', parent: 'gnode', tone: 'sky' },
    { id: 'rdma', label: 'RDMA device plugin', detail: 'rdma/hca_devices', parent: 'gnode' },
    { id: 'multus', label: 'Multus + whereabouts', detail: 'net1', parent: 'gnode' },
    { id: 'ctrd', label: 'containerd', detail: 'CDI', parent: 'gnode' },
    { id: 'ctr', label: 'prefill container', parent: 'gnode', tone: 'pink' },
  ],
  edges: [
    { from: 'op', to: 'drv', label: 'DaemonSet' },
    { from: 'drv', to: 'api', label: 'ResourceSlice' },
    { from: 'api', to: 'kubelet', label: 'bound Pod' },
    { from: 'kubelet', to: 'drv', label: 'prepare' },
    { from: 'kubelet', to: 'rdma', label: 'Allocate' },
    { from: 'kubelet', to: 'multus', label: 'CNI ADD' },
    { from: 'kubelet', to: 'ctrd', label: 'CreateContainer' },
    { from: 'ctrd', to: 'ctr', label: 'device nodes' },
  ],
});
