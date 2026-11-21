/** One prefill Pod's life: who talks to whom, from Deployment to running container. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'auto',
  direction: 'auto',
  groups: [
    { id: 'cp', label: 'Control plane', tone: 'primary' },
    { id: 'gnode', label: 'GPU node gpu-node-1', tone: 'muted' },
  ],
  nodes: [
    { id: 'rsc', label: 'ReplicaSet controller', parent: 'cp', detail: 'creates the Pod' },
    { id: 'rcc', label: 'resourceclaim controller', parent: 'cp', detail: 'creates the claim' },
    { id: 'api', label: 'API server', parent: 'cp', shape: 'store', detail: 'Pod, ResourceClaim, ResourceSlice', tone: 'note' },
    { id: 'sched', label: 'kube-scheduler', parent: 'cp', detail: 'DynamicResources plugin' },
    { id: 'kubelet', label: 'kubelet', parent: 'gnode', tone: 'sky' },
    { id: 'drv', label: 'AMD DRA driver', parent: 'gnode', detail: 'gpu.amd.com', tone: 'teal' },
    { id: 'ctrd', label: 'containerd', parent: 'gnode', detail: 'CDI enabled' },
    { id: 'ctr', label: 'prefill container', parent: 'gnode', detail: 'card5 + renderD132', tone: 'pink' },
  ],
  edges: [
    { from: 'rsc', to: 'api', label: 'create Pod' },
    { from: 'rcc', to: 'api', label: 'create claim' },
    { from: 'sched', to: 'api', label: 'allocate + bind' },
    { from: 'kubelet', to: 'api', label: 'watch Pod, read claim' },
    { from: 'kubelet', to: 'drv', label: 'NodePrepareResources' },
    { from: 'kubelet', to: 'ctrd', label: 'CreateContainer + CDI IDs' },
    { from: 'ctrd', to: 'ctr', label: 'device nodes' },
  ],
});
