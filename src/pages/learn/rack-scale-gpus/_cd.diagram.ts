/** ComputeDomain lifecycle with the NVIDIA DRA driver (per NVIDIA docs). */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'user', label: 'Workload owner', tone: 'pink' },
    { id: 'api', label: 'apiserver + scheduler' },
    { id: 'cd', label: 'compute-domain plugin', tone: 'teal' },
    { id: 'imex', label: 'IMEX daemons (trays A, B)', tone: 'lime' },
    { id: 'pods', label: 'Pods on trays A, B', tone: 'primary' },
  ],
  messages: [
    { from: 'user', to: 'api', label: 'create ComputeDomain (numNodes: 2) + Pods with channel claims' },
    { from: 'api', to: 'pods', label: 'schedule Pods onto two trays of one rack' },
    { from: 'cd', to: 'imex', label: 'start or reconfigure IMEX for these nodes' },
    { from: 'cd', to: 'pods', label: 'inject IMEX channel device into containers' },
    { from: 'pods', to: 'pods', label: 'share GPU memory over NVLink', tone: 'good' },
    { from: 'user', to: 'api', label: 'workload ends' },
    { from: 'cd', to: 'imex', label: 'tear down domain', tone: 'muted' },
  ],
  frames: [
    { label: 'Form', from: 'm1', to: 'm4', tone: 'teal' },
    { label: 'Tear down', from: 'm6', to: 'm7', tone: 'muted' },
  ],
});
