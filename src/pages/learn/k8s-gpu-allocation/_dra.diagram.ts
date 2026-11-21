/** DRA objects and writers. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'auto',
  direction: 'auto',
  groups: [
    { id: 'node', label: 'GPU node', tone: 'muted' },
    { id: 'api', label: 'Kubernetes API', tone: 'primary' },
  ],
  nodes: [
    { id: 'drv', label: 'DRA driver', parent: 'node', detail: 'k8s-gpu-dra-driver', tone: 'teal' },
    { id: 'slice', label: 'ResourceSlice', parent: 'api', detail: '8 GPUs + attributes' },
    { id: 'class', label: 'DeviceClass', parent: 'api', detail: 'gpu.amd.com' },
    { id: 'tmpl', label: 'ResourceClaimTemplate', parent: 'api', detail: '1 GPU' },
    { id: 'claim', label: 'ResourceClaim', parent: 'api', detail: 'status.allocation', tone: 'note' },
    { id: 'pod', label: 'Pod', parent: 'api', tone: 'pink' },
    { id: 'sched', label: 'Scheduler', shape: 'pill' },
  ],
  edges: [
    { from: 'drv', to: 'slice', label: 'publishes' },
    { from: 'tmpl', to: 'claim', label: 'one per Pod' },
    { from: 'pod', to: 'claim', label: 'uses' },
    { from: 'sched', to: 'slice', label: 'reads', style: 'dashed' },
    { from: 'sched', to: 'class', style: 'dashed' },
    { from: 'sched', to: 'claim', label: 'writes allocation' },
  ],
});
