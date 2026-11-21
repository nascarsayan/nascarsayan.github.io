/** Example pipeline: one top-level group per stage, laid out as columns. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'code', label: 'Code', tone: 'sky' },
    { id: 'ci', label: 'CI', tone: 'primary' },
    { id: 'out', label: 'Release', tone: 'good' },
  ],
  nodes: [
    { id: 'src', label: 'Repository', parent: 'code' },
    { id: 'build', label: 'Build', parent: 'ci' },
    { id: 'test', label: 'Test', parent: 'ci' },
    { id: 'publish', label: 'Publish', parent: 'out' },
    { id: 'site', label: 'Website', shape: 'external', parent: 'out' },
  ],
  edges: [
    { from: 'src', to: 'build', label: 'push' },
    { from: 'build', to: 'test' },
    { from: 'test', to: 'publish' },
    { from: 'publish', to: 'site' },
  ],
});
