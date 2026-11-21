/** Double-buffered K loop of one workgroup: loads into one LDS buffer while MFMAs read the other. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  groups: [{ id: 'cu', label: 'Compute unit', tone: 'good', direction: 'down' }],
  nodes: [
    { id: 'hbm', label: 'A and B in HBM', shape: 'store', tone: 'peach', detail: 'via L2 / Infinity Cache' },
    { id: 'buf0', label: 'LDS buffer 0', shape: 'store', tone: 'lime', detail: 'one A slice + one B slice' },
    { id: 'buf1', label: 'LDS buffer 1', shape: 'store', tone: 'lime', detail: 'one A slice + one B slice' },
    { id: 'mfma', label: 'Matrix cores', parent: 'cu', tone: 'good', detail: 'v_mfma on fragments', info: 'Each wave reads its A and B fragments with ds_read and issues MFMAs that add into its accumulators.' },
    { id: 'acc', label: 'Accumulators', parent: 'cu', tone: 'sky', detail: 'FP32, in AGPRs', info: 'Stay in registers for the whole K loop. Never written to memory until the epilogue.' },
    { id: 'c', label: 'C tile in HBM', shape: 'store', tone: 'peach', detail: 'BF16 after the epilogue' },
  ],
  edges: [
    { from: 'hbm', to: 'buf0', label: 'load step k' },
    { from: 'hbm', to: 'buf1', label: 'load step k+1' },
    { from: 'buf0', to: 'mfma', label: 'ds_read' },
    { from: 'buf1', to: 'mfma', label: 'ds_read' },
    { from: 'mfma', to: 'acc', label: '+=' },
    { from: 'acc', to: 'c', label: 'epilogue' },
  ],
});
