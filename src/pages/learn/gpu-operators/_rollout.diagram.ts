/** One DeviceConfig change rolling the DRA driver DaemonSet over the example's GPU nodes. */
import { defineDiagram } from '@/diagrams/spec';
import { nodes as gpuNodes } from './_rollout';

const nid = (n: string) => n.replaceAll('-', '_');
// Control plane on top, the DaemonSet fanning down to one row of GPU nodes: a wide, short picture.
export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'down',
  groups: [
    { id: 'cp', label: 'API server and management node', tone: 'primary', direction: 'right' },
    { id: 'gnode', label: 'GPU nodes (DRA driver Pod per node)', tone: 'teal', direction: 'down' },
  ],
  nodes: [
    { id: 'helm', label: 'helm upgrade', shape: 'pill', parent: 'cp' },
    { id: 'dc', label: 'DeviceConfig default', parent: 'cp', tone: 'note', detail: 'draDriver.image' },
    { id: 'ctl', label: 'controller-manager', parent: 'cp', detail: 'reconcile loop' },
    { id: 'ds', label: 'DaemonSet default-dra-driver', parent: 'cp', detail: 'maxUnavailable 1, maxSurge 0' },
    ...gpuNodes.map((n) => ({ id: nid(n), label: n, parent: 'gnode', detail: 'v0.3.0', tone: 'muted' as const })),
  ],
  edges: [
    { from: 'helm', to: 'dc', label: 'renders' },
    { from: 'ctl', to: 'dc', label: 'watches', style: 'dashed' },
    { from: 'ctl', to: 'ds', label: 'applies' },
    ...gpuNodes.map((n) => ({ from: 'ds', to: nid(n) })),
  ],
});
