/**
 * One illustrative gpt-oss-120b request (2,760-token prompt, first 256 tokens in
 * the prefix cache), with everything derived from the public config: prefix
 * blocks, FLOPs, KV bytes, and times at an assumed share of an MI355X's peak.
 */

// gpt-oss-120b, from config.json and the model card.
const g = {
  layers: 36,
  fullLayers: 18,
  window: 128,
  topk: 4,
  expertParams: 3 * 2880 * 2880, // SwiGLU gate, up, down
  attnParams: 0.96e9, // Q, K, V, O over all layers (model card)
  unembedParams: 201088 * 2880, // lm_head
  kvPerTokenLayer: 2 * 8 * 64 * 2, // K and V, 8 KV heads × 64, 2 bytes: 2 KiB
  attnFlopsPerCtx: 4 * 64 * 64, // per layer, per new token, per token of context
};
/** KV bytes one sequence holds at context `ctx` (window-aware: sliding layers keep 128 tokens). */
const kvBytes = (ctx: number) => g.kvPerTokenLayer * (g.fullLayers * ctx + (g.layers - g.fullLayers) * Math.min(ctx, g.window));
/** Linear-layer FLOPs per token: 2 per active weight (attention, 4 experts × 36 layers, unembedding). */
const linearFlopsPerToken = 2 * (g.attnParams + g.topk * g.layers * g.expertParams + g.unembedParams);

/** MI355X dense FP8 peak, spec sheet, approximate. */
export const PEAK = 5e15;
/** Assumed share of peak a real prefill step reaches. */
export const MFU = 0.3;

export const req = { prompt: 2760, cached: 256, uncached: 2504 } as const;

/** Prompt cut into 128-token blocks: tokens per block, first `cached / 128` were prefix-cache hits. */
export const BLOCK = 128;
export const blocks = Array.from({ length: Math.ceil(req.prompt / BLOCK) }, (_, i) => Math.min(BLOCK, req.prompt - i * BLOCK));
export const cachedBlocks = req.cached / BLOCK;
/** Blocks laid out as a grid of rows of 11 for the <Matrix>. */
export const blockGrid = (() => {
  const per = 11, rows: (number | null)[][] = [];
  for (let i = 0; i < blocks.length; i += per) rows.push(Array.from({ length: per }, (_, j) => blocks[i + j] ?? null));
  return rows;
})();

/** FLOPs for the uncached tokens: linear (no unembedding except the last token) + causal attention over cached + new tokens. */
const unembed = 2 * g.unembedParams;
const linear = (linearFlopsPerToken - unembed) * req.uncached + unembed;
let attn = 0;
for (let i = 0; i < req.uncached; i++) {
  const ctx = req.cached + i + 1;
  attn += g.attnFlopsPerCtx * (g.fullLayers * ctx + (g.layers - g.fullLayers) * Math.min(ctx, g.window));
}
export const flops = linear + attn;
export const idealMs = (flops / PEAK) * 1e3;
export const realMs = idealMs / MFU;
export const kv = kvBytes(req.prompt);
export const kvNaive = req.prompt * g.layers * g.kvPerTokenLayer;
export const layers = g.layers;

/** Prefill-time model for the explorer: a fixed overhead plus tokens at MFU × peak. */
export const fit = { fixedS: 0.01, tokensPerS: Math.round(PEAK * MFU / (linearFlopsPerToken - unembed)) };

export const fmtMiB = (b: number) => `${(b / 2 ** 20).toFixed(1)} MiB`;
export const fmtT = (f: number) => `${(f / 1e12).toFixed(1)} TFLOP`;
