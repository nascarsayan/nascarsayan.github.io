/** AMD GPU Operator Device Config Manager (DCM) repartitioning one node, as documented. Drawn in its "before" state; Steps change it. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  direction: 'right',
  groups: [
    { id: 'sched', label: 'GPU node: scheduling', tone: 'muted' },
    { id: 'conf', label: 'GPU node: GPU configuration', tone: 'muted' },
  ],
  nodes: [
    { id: 'op', label: 'Operator (a human)', shape: 'external', tag: 'kubectl' },
    { id: 'k8s', label: 'Node object', parent: 'sched', detail: 'no DCM taint', tone: 'neutral' },
    { id: 'pods', label: 'Inference Pods', parent: 'sched', detail: '8 running', tone: 'good' },
    { id: 'dcm', label: 'DCM', parent: 'conf', detail: 'idle', tone: 'neutral', info: 'Device Config Manager, part of the AMD GPU Operator. Runs only when configManager.enable is true.' },
    { id: 'gpu', label: '8 × MI355X', parent: 'conf', detail: 'SPX + NPS1', tone: 'sky' },
    { id: 'slice', label: 'ResourceSlice', parent: 'conf', detail: '8 devices', tone: 'sky', info: 'Published by the AMD DRA driver from what the GPUs report.' },
  ],
  edges: [
    { from: 'op', to: 'k8s', label: 'taint, label' },
    { from: 'k8s', to: 'pods', label: 'NoExecute' },
    { from: 'k8s', to: 'dcm', label: 'profile label' },
    { from: 'dcm', to: 'gpu', label: 'amd-smi set' },
    { from: 'gpu', to: 'slice', label: 'DRA driver' },
  ],
});
