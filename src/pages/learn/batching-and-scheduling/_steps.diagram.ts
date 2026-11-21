/** Continuous batching with chunked prefill: three steps of an aggregated server. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 's1', label: 'Step n', tone: 'primary' },
    { id: 's2', label: 'Step n+1', tone: 'primary' },
    { id: 's3', label: 'Step n+2', tone: 'primary' },
  ],
  nodes: [
    { id: 'd1', label: '60 decodes', detail: '60 tokens', parent: 's1', tone: 'violet' },
    { id: 'p1', label: 'Prompt X, chunk 1', detail: '8,132 of 20,000 tokens', parent: 's1', tone: 'pink' },
    { id: 'd2', label: '59 decodes', detail: 'one request finished and left', parent: 's2', tone: 'violet' },
    { id: 'p2', label: 'Prompt X, chunk 2', detail: '8,133 tokens', parent: 's2', tone: 'pink' },
    { id: 'd3', label: '59 decodes', detail: '59 tokens', parent: 's3', tone: 'violet' },
    { id: 'p3', label: 'Prompt X, last chunk', detail: '3,735 tokens', parent: 's3', tone: 'pink' },
    { id: 'p4', label: 'Prompt Y, whole', detail: '600 tokens, joins at once', parent: 's3', tone: 'peach' },
  ],
  edges: [],
});
