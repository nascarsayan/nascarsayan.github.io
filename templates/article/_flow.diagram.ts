/** Example graph: a client, an API, a queue and a store. Files starting with `_` are not routes. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [{ id: 'svc', label: 'Service', tone: 'primary', direction: 'right' }],
  nodes: [
    { id: 'client', label: 'Client', tag: 'browser' },
    { id: 'api', label: 'API', detail: 'validates and routes', parent: 'svc' },
    { id: 'queue', label: 'Queue', parent: 'svc' },
    { id: 'store', label: 'Store', shape: 'store', info: 'Longer text goes in `info`: it shows in a hover card.' },
  ],
  edges: [
    { from: 'client', to: 'api', label: 'HTTPS' },
    { from: 'api', to: 'queue', label: 'enqueue' },
    { from: 'api', to: 'store', label: 'read' },
  ],
});
