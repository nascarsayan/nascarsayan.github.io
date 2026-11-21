/** FlashAttention forward pass: one workgroup, one block of query rows. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'hbm', label: 'HBM', detail: 'Q, K, V, O', tone: 'peach' },
    { id: 'lds', label: 'LDS', detail: 'K and V block', tone: 'lime' },
    { id: 'mx', label: 'Matrix cores', detail: 'v_mfma / mma', tone: 'good' },
    { id: 'alu', label: 'Vector ALU', detail: 'max, exp, scale', tone: 'sky' },
  ],
  messages: [
    { from: 'hbm', to: 'mx', label: 'load Q block (e.g. 128 rows) into registers, once' },
    { from: 'hbm', to: 'lds', label: 'load K_j, V_j (e.g. 64 keys)' },
    { from: 'lds', to: 'mx', label: 'S = Q·K_jᵀ ÷ √d' },
    { from: 'mx', to: 'alu', label: 'S tile stays in registers' },
    { from: 'alu', to: 'alu', label: 'mask, new row max m, P = exp(S − m), update sum l, rescale O' },
    { from: 'alu', to: 'mx', label: 'P (cast to BF16/FP8)' },
    { from: 'lds', to: 'mx', label: 'O += P·V_j' },
    { from: 'mx', to: 'hbm', label: 'after last block: O ÷ l, store O (and l, m)', tone: 'good' },
  ],
  frames: [
    { label: 'for each K/V block j (causal: only j up to the diagonal)', from: 'm2', to: 'm7', tone: 'note' },
  ],
});
