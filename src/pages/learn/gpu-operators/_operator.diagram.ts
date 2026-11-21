/** AMD GPU operator: what Helm creates and what the controller renders. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  groups: [
    { id: 'helm', label: 'Helm release amd-gpu-operator', tone: 'primary' },
    { id: 'gnode', label: 'Every node with gpu-vendor=AMD', tone: 'teal' },
  ],
  nodes: [
    { id: 'chart', label: 'Wrapper chart 0.1.0', shape: 'pill', detail: 'upstream gpu-operator-charts v1.4.0' },
    { id: 'ctl', label: 'controller-manager', parent: 'helm', detail: 'Deployment, 1 replica, management node' },
    { id: 'dc', label: 'DeviceConfig default', parent: 'helm', tone: 'note', detail: 'amd.com/v1alpha1' },
    { id: 'cls', label: 'DeviceClass gpu.amd.com', parent: 'helm' },
    { id: 'dra', label: 'default-dra-driver', parent: 'gnode', detail: 'DaemonSet' },
    { id: 'lab', label: 'default-node-labeller', parent: 'gnode', detail: 'DaemonSet' },
    { id: 'exp', label: 'default-metrics-exporter', parent: 'gnode', detail: 'DaemonSet + Service + ServiceMonitor' },
  ],
  edges: [
    { from: 'chart', to: 'ctl', label: 'installs' },
    { from: 'chart', to: 'dc', label: 'renders' },
    { from: 'chart', to: 'cls', label: 'renders' },
    { from: 'ctl', to: 'dc', label: 'watches', style: 'dashed' },
    { from: 'ctl', to: 'dra', label: 'owns' },
    { from: 'ctl', to: 'lab', label: 'owns' },
    { from: 'ctl', to: 'exp', label: 'owns' },
  ],
});
