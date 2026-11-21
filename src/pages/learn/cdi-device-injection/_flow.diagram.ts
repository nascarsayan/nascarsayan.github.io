/** The CDI path for claim c1a10001… on gpu-node-1: who writes, who reads, who creates. */
import { defineDiagram } from '@/diagrams/spec';

// Prepare and create are two columns on GPU node gpu-node-1; the spec directory both use is a row below.
export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'prep', label: 'Prepare: once per claim', tone: 'muted' },
    { id: 'create', label: 'Create: every container start', tone: 'muted' },
  ],
  nodes: [
    { id: 'kubelet', label: 'kubelet', parent: 'prep', detail: 'holds the CDI IDs' },
    { id: 'drv', label: 'DRA driver', parent: 'prep', tone: 'teal', detail: 'gpu-kubeletplugin v1.0.1' },
    { id: 'cdi', label: '/var/run/cdi', band: 1, shape: 'store', tone: 'note', detail: 'common + one file per claim' },
    { id: 'ctrd', label: 'containerd 2.2', parent: 'create', tone: 'primary', detail: 'CRI + CDI cache' },
    { id: 'runc', label: 'runc', parent: 'create', detail: 'creates the container' },
    { id: 'ctr', label: 'container prefill', parent: 'create', tone: 'pink', detail: 'kfd, card5, renderD132' },
  ],
  edges: [
    { from: 'kubelet', to: 'drv', label: 'NodePrepareResources' },
    { from: 'drv', to: 'cdi', label: 'write spec' },
    { from: 'kubelet', to: 'ctrd', label: 'CreateContainer + CDI IDs' },
    { from: 'ctrd', to: 'cdi', label: 'resolve names' },
    { from: 'ctrd', to: 'runc', label: 'OCI spec' },
    { from: 'runc', to: 'ctr', label: 'mknod + cgroup' },
  ],
});
