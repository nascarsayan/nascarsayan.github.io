/**
 * DRA driver restart on one GPU node, drawn healthy; each <Step> of the story
 * overrides tones/details. Kubelet 1.35: defaultWipingDelay = 30 s
 * (pkg/kubelet/cm/dra/manager.go).
 */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  groups: [
    { id: 'host', label: 'GPU node gpu-node-1', tone: 'muted' },
    { id: 'cp', label: 'Control plane', tone: 'primary' },
  ],
  nodes: [
    { id: 'drv', label: 'DRA driver Pod', parent: 'host', tone: 'teal', detail: 'registered, dra.sock open' },
    { id: 'kubelet', label: 'kubelet', parent: 'host', detail: 'plugin gpu.amd.com known' },
    { id: 'run', label: 'Running Pod …-p4x7k', parent: 'host', tone: 'good', detail: 'has card5 + renderD132' },
    { id: 'newpod', label: 'New GPU Pod', parent: 'host', detail: 'bound here, claim allocated' },
    { id: 'slice', label: 'ResourceSlice', parent: 'cp', shape: 'store', detail: '8 devices of gpu-node-1' },
    { id: 'sched', label: 'Scheduler', parent: 'cp', detail: 'places GPU Pods' },
  ],
  edges: [
    { from: 'kubelet', to: 'drv', label: 'NodePrepare Resources' },
    { from: 'newpod', to: 'kubelet', label: 'start me' },
    { from: 'drv', to: 'slice', label: 'publish' },
    { from: 'kubelet', to: 'slice', label: 'wipe after 30 s', style: 'dashed' },
    { from: 'sched', to: 'slice', label: 'read free GPUs' },
  ],
});
