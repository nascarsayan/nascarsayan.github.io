/** Intuition for the roofline: a kitchen fed by one delivery road. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  nodes: [
    { id: 'store', label: 'Warehouse (HBM)', shape: 'store', tone: 'peach', detail: 'huge, far · road: ~8 TB/s' },
    { id: 'shelf', label: 'Shelves near the stove', shape: 'store', tone: 'lime', detail: 'caches, LDS, registers' },
    { id: 'cook', label: 'Cooks (math units)', tone: 'good', detail: '~2,500 TFLOP/s (BF16)' },
    { id: 'dish', label: 'Finished dishes', shape: 'external', detail: 'results' },
  ],
  edges: [
    { from: 'store', to: 'shelf', label: 'delivery road' },
    { from: 'shelf', to: 'cook', label: 'grab' },
    { from: 'cook', to: 'dish' },
  ],
});
