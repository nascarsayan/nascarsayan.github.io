/** Intuition for tiling: 16 sandwiches from 4 breads and 4 fillings. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  nodes: [
    { id: 'pantry', label: 'Pantry (HBM)', shape: 'store', tone: 'peach', detail: '4 breads (A rows), 4 fillings (B cols)' },
    { id: 'table', label: 'Team table (LDS)', shape: 'store', tone: 'lime', detail: 'holds one tile’s ingredients' },
    { id: 'team', label: 'The team (one workgroup)', tone: 'good', detail: '16 sandwiches = 4 × 4 outputs' },
  ],
  edges: [
    { from: 'pantry', to: 'table', label: 'fetch once' },
    { from: 'table', to: 'team', label: 'reuse' },
    { from: 'pantry', to: 'team', label: 'fetch per sandwich', style: 'dashed' },
  ],
});
