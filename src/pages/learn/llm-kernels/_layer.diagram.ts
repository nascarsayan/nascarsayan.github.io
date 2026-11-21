/** One gpt-oss-120b transformer layer as the kernels a GPU runs. */
import { defineDiagram } from '@/diagrams/spec';
import { boxLine, pre, dec, type Row } from './_example';

const base = defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'attn', label: 'Attention block', tone: 'sky' },
    { id: 'moe', label: 'MoE block', tone: 'pink' },
  ],
  nodes: [
    { id: 'n1', label: 'RMSNorm', parent: 'attn', detail: 'element-wise, memory-bound', tone: 'muted' },
    { id: 'qkv', label: 'QKV GEMM', parent: 'attn', detail: '2880 → 5120', tone: 'good' },
    { id: 'rope', label: 'RoPE + KV write', parent: 'attn', detail: 'reshape_and_cache', info: 'Rotary position embedding on Q and K, then each token K and V row is copied into its paged KV-cache slot.' },
    { id: 'fa', label: 'Attention', parent: 'attn', detail: 'FlashAttention / paged', tone: 'good' },
    { id: 'o', label: 'O-proj GEMM', parent: 'attn', detail: '4096 → 2880, + residual', tone: 'good' },
    { id: 'n2', label: 'RMSNorm', parent: 'moe', detail: 'element-wise', tone: 'muted' },
    { id: 'rt', label: 'Router GEMM + top-4', parent: 'moe', detail: '2880 → 128 experts' },
    { id: 'al', label: 'moe_align_block_size', parent: 'moe', detail: 'sort tokens by expert' },
    { id: 'g1', label: 'Grouped GEMM gate/up', parent: 'moe', detail: '2880 → 2 × 2880, SwiGLU', tone: 'good' },
    { id: 'g2', label: 'Grouped GEMM down', parent: 'moe', detail: '2880 → 2880, combine + residual', tone: 'good' },
  ],
  edges: [
    { from: 'n1', to: 'qkv' },
    { from: 'qkv', to: 'rope' },
    { from: 'rope', to: 'fa' },
    { from: 'fa', to: 'o' },
    { from: 'o', to: 'n2', label: 'hidden state' },
    { from: 'n2', to: 'rt' },
    { from: 'rt', to: 'al' },
    { from: 'al', to: 'g1' },
    { from: 'g1', to: 'g2' },
  ],
});

export default base;

/** The same layer with each kernel's numbers for one phase in its box (green: compute-bound, amber: memory-bound). */
const withRows = (rows: Row[]) => ({
  ...base,
  nodes: base.nodes.map((n) => {
    const r = rows.find((x) => x.id === n.id);
    return r ? { ...n, detail: boxLine(r), tone: r.bound === 'compute' ? ('good' as const) : ('warn' as const), info: `${n.info ?? n.detail}. ${r.shape}.` } : { ...n, tone: 'muted' as const };
  }),
});
export const prefillLayer = withRows(pre);
export const decodeLayer = withRows(dec);
