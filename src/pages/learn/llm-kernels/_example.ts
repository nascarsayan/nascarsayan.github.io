/**
 * One gpt-oss-120b layer as kernels, with FLOPs, bytes and a roofline time
 * bound per kernel, computed at build time for a prefill and a decode step.
 *
 * Model shapes: published config.json (hidden 2880, 36 layers alternating
 * sliding/full attention, window 128, 64 query heads and 8 KV heads of 64,
 * 128 experts, 4 per token, expert width 2880, vocab 201088, MXFP4 experts;
 * attention, router and LM head not quantized).
 * Assumptions (stated on the page): BF16 activations, KV cache and non-expert
 * weights; MXFP4 = 4.25 bits per weight; expert GEMMs at the FP8 peak (w4a8,
 * not verified); MI355X spec peaks (approximate): 8 TB/s HBM, 2.5 PFLOP/s
 * BF16, 5.0 PFLOP/s FP8 dense; uniform random expert routing; FlashAttention
 * with 128-row query blocks, K/V read once per (query block, KV head).
 * The result is a lower bound per kernel (max of the two roofline limits),
 * not a prediction: real kernels reach a fraction of peak.
 */
export const cfg = { hidden: 2880, layers: 36, heads: 64, kvHeads: 8, headDim: 64, experts: 128, topk: 4, inter: 2880, vocab: 201088, window: 128 };
const { hidden: H, heads, kvHeads, headDim: hd, experts, topk, inter, vocab, window } = cfg;
const qDim = heads * hd;              // 4096
const kvDim = kvHeads * hd;           // 512
const qkvN = qDim + 2 * kvDim;        // 5120
const A = 2;                          // bytes per BF16 value
const W4 = 4.25 / 8;                  // bytes per MXFP4 weight
export const peaks = { bw: 8e12, bf16: 2.5e15, fp8: 5.0e15 };

export interface Kernel {
  id: string;            // diagram node id
  name: string;
  kind: 'element' | 'gemm' | 'attention' | 'moe';
  shape: string;         // human-readable shape
  flops: number;
  bytes: number;
  peak: number;          // FLOP/s ceiling used
  note?: string;
}
export interface Row extends Kernel { intensity: number; ridge: number; time: number; bound: 'memory' | 'compute' }

const gemm = (id: string, name: string, M: number, K: number, N: number, wBytes = A, peak = peaks.bf16): Kernel => ({
  id, name, kind: 'gemm', shape: `[${M.toLocaleString('en-US')} × ${K.toLocaleString('en-US')}] · [${K.toLocaleString('en-US')} × ${N.toLocaleString('en-US')}]`,
  flops: 2 * M * K * N, bytes: K * N * wBytes + M * K * A + M * N * A, peak,
});
const norm = (id: string, M: number): Kernel => ({ id, name: 'RMSNorm', kind: 'element', shape: `${M.toLocaleString('en-US')} rows × ${H.toLocaleString('en-US')}`, flops: 4 * M * H, bytes: 2 * M * H * A + H * A, peak: peaks.bf16 });

/** Expected number of distinct experts hit by M tokens with uniform routing (4 distinct of 128 per token). */
export const touched = (M: number) => experts * (1 - Math.pow((experts - topk) / experts, M));

/** Attention FLOPs and bytes. prefill: T tokens, causal. decode: B sequences, each with ctx cached tokens. */
function attention(mode: 'prefill' | 'decode', M: number, ctx: number, sliding: boolean): Kernel {
  if (mode === 'prefill') {
    let pairs = 0, kvReads = 0;
    for (let i = 0; i < M; i++) pairs += sliding ? Math.min(i + 1, window) : i + 1;
    const br = 128;
    for (let b = 0; b * br < M; b++) {
      const last = Math.min(M, (b + 1) * br) - 1, first = b * br;
      const lo = sliding ? Math.max(0, first - window + 1) : 0;
      kvReads += last + 1 - lo; // keys this query block visits
    }
    return {
      id: 'fa', name: 'FlashAttention', kind: 'attention', shape: `${M.toLocaleString('en-US')} queries × ${sliding ? `≤ ${window}` : 'all earlier'} keys, 64 heads`,
      flops: 4 * heads * hd * pairs, bytes: 2 * M * qDim * A + kvHeads * kvReads * 2 * hd * A, peak: peaks.bf16,
    };
  }
  const n = sliding ? Math.min(ctx, window) : ctx;
  return {
    id: 'fa', name: 'Paged attention', kind: 'attention', shape: `${M} seqs × 1 query × ${n.toLocaleString('en-US')} cached keys`,
    flops: 4 * heads * hd * n * M, bytes: M * n * 2 * kvDim * A + 2 * M * qDim * A, peak: peaks.bf16,
  };
}

/** The kernels of one layer for M rows (prefill: prompt tokens; decode: sequences). */
export function layer(mode: 'prefill' | 'decode', M: number, ctx: number, sliding: boolean): Row[] {
  const assign = M * topk;
  const hit = touched(M);
  const ks: Kernel[] = [
    norm('n1', M),
    gemm('qkv', 'QKV projection', M, H, qkvN),
    { id: 'rope', name: 'RoPE + KV write', kind: 'element', shape: `${M.toLocaleString('en-US')} rows: rotate Q, K; copy K, V to cache`, flops: 3 * M * (qDim + kvDim), bytes: 2 * M * (qDim + kvDim) * A + 2 * M * 2 * kvDim * A, peak: peaks.bf16 },
    attention(mode, M, ctx, sliding),
    gemm('o', 'Output projection', M, qDim, H),
    norm('n2', M),
    { ...gemm('rt', 'Router + top-4', M, H, experts), note: 'then top-4 of 128 per token' },
    {
      id: 'g1', name: 'Experts gate/up (grouped GEMM)', kind: 'moe',
      shape: `${assign.toLocaleString('en-US')} token-expert pairs, ~${(assign / experts).toFixed(1)} per expert, ${Math.round(hit)} experts hit`,
      flops: 2 * assign * H * 2 * inter, bytes: hit * H * 2 * inter * W4 + assign * (H + 2 * inter) * A, peak: peaks.fp8,
    },
    {
      id: 'g2', name: 'Experts down (grouped GEMM)', kind: 'moe',
      shape: `${assign.toLocaleString('en-US')} pairs, [${inter.toLocaleString('en-US')} → ${H.toLocaleString('en-US')}] per expert`,
      flops: 2 * assign * inter * H, bytes: hit * inter * H * W4 + assign * (inter + H) * A, peak: peaks.fp8,
    },
  ];
  return ks.map(finish);
}
const finish = (k: Kernel): Row => {
  const tm = k.bytes / peaks.bw, tc = k.flops / k.peak;
  return { ...k, intensity: k.flops / k.bytes, ridge: k.peak / peaks.bw, time: Math.max(tm, tc), bound: tm >= tc ? 'memory' : 'compute' };
};

/** LM head: prefill needs it only for the last prompt token; decode for every sequence. */
export const lmHead = (M: number) => finish(gemm('lm', 'LM head', M, H, vocab));

// The two cases on the page. Prefill: a 4,085-token prompt; decode: 64 sequences with 4,000 cached tokens each.
export const T = 4085;
export const Bdec = 64;
export const ctx = 4000;
export const pre = layer('prefill', T, 0, false);
export const dec = layer('decode', Bdec, ctx, false);
export const preSliding = layer('prefill', T, 0, true);
export const decSliding = layer('decode', Bdec, ctx, true);

const sum = (rs: Row[]) => rs.reduce((a, r) => a + r.time, 0);
const half = cfg.layers / 2; // 18 full + 18 sliding
export const preStep = half * (sum(pre) + sum(preSliding)) + lmHead(1).time;
export const decStep = half * (sum(dec) + sum(decSliding)) + lmHead(Bdec).time;
export const preShare = (k: string) => (half * ((pre.find((r) => r.id === k)?.time ?? 0) + (preSliding.find((r) => r.id === k)?.time ?? 0))) / preStep;
export const decShare = (k: string) => (half * ((dec.find((r) => r.id === k)?.time ?? 0) + (decSliding.find((r) => r.id === k)?.time ?? 0))) / decStep;

// ---- formatting ----
const si = (x: number, unit: string) => {
  const u = [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k']] as const;
  for (const [v, p] of u) if (x >= v) return `${(x / v).toFixed(x / v >= 100 ? 0 : 1)} ${p}${unit}`;
  return `${x.toFixed(0)} ${unit}`;
};
export const fFlops = (x: number) => si(x, 'FLOP');
export const fBytes = (x: number) => si(x, 'B');
export const fTime = (s: number) => (s >= 1e-3 ? `${(s * 1e3).toFixed(2)} ms` : `${(s * 1e6).toFixed(1)} µs`);
export const fI = (x: number) => (x >= 10 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1));
/** One-line summary for a diagram box (≤ 48 characters). */
export const boxLine = (r: Row) => `${fI(r.intensity)} FLOP/B · ${fTime(r.time)} · ${r.bound}`;

/** Weight bytes of one layer (attention + router in BF16, 128 MXFP4 experts) and of all layers. */
export const layerWeightBytes = (H * qkvN + qDim * H + H * experts) * A + experts * (H * 2 * inter + inter * H) * W4;
export const allWeightBytes = cfg.layers * layerWeightBytes;

/** Step narration per kernel and phase (numbers from the rows). */
export function stepText(r: Row, phase: 'prefill' | 'decode') {
  const lim = r.bound === 'compute'
    ? `compute-bound: the matrix cores need ${fTime(r.flops / r.peak)}, more than the ${fTime(r.bytes / peaks.bw)} to read ${fBytes(r.bytes)}`
    : `memory-bound: reading ${fBytes(r.bytes)} takes ${fTime(r.bytes / peaks.bw)}, the math only ${fTime(r.flops / r.peak)}`;
  return `${r.name}, ${r.shape}: ${fFlops(r.flops)}, ${fI(r.intensity)} FLOP/B against a ridge of ~${Math.round(r.ridge)}, so ${lim}.${phase === 'decode' && r.kind === 'moe' ? ' Most experts get one or two tokens, so their weights are read for almost no math.' : ''}`;
}
/** Share of the step's (lower-bound) time per kernel, both phases, for a heatmap. */
export const shareIds = ['n1', 'qkv', 'rope', 'fa', 'o', 'n2', 'rt', 'g1', 'g2'];
export const shareNames = shareIds.map((id) => pre.find((r) => r.id === id)!.name.replace(' (grouped GEMM)', ''));
export const shares = shareIds.map((id) => [Math.round(preShare(id) * 1000) / 10, Math.round(decShare(id) * 1000) / 10]);
