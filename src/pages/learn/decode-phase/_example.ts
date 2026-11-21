/**
 * Decode byte and time model for this page, computed at build time.
 * gpt-oss-120b in its published formats (attention and unembedding 16-bit,
 * experts MXFP4 at 4.25 bits); MI355X ~8 TB/s HBM and ~5 PFLOP/s FP8 dense are
 * spec-sheet numbers (approximate). Random routing for MoE expert counts.
 */
export const BW = 8e12;
export const PEAK = 5e15;
const EXPERT = 24.9e6, LAYERS = 36, EXPERTS = 128, TOPK = 4, BITS = 4.25;

export const attnW = 0.96e9 * 2;       // attention weights, all layers, bytes
export const unembW = 0.58e9 * 2;      // unembedding, bytes
export const expertBytes = EXPERT * BITS / 8; // one expert, bytes
/** Expected distinct experts per layer for B tokens with random top-4 routing. */
export const touched = (B: number) => EXPERTS * (1 - (1 - TOPK / EXPERTS) ** B);
/** KV bytes read for one sequence at context `ctx` (window-aware, 16-bit): 18 full layers + 18 sliding (128). */
export const kvRead = (ctx: number) => 18 * 2048 * ctx + 18 * 2048 * Math.min(ctx, 128);
/** KV written per token: K and V in all 36 layers, 8 heads × 64, 16-bit. */
export const kvWrite = 36 * 2 * 8 * 64 * 2;
/** FLOPs per decode token at context ctx: ~9 GFLOP linear + attention over the full layers and the window. */
export const flopsTok = (ctx: number) => 9e9 + 4 * 64 * 64 * (18 * ctx + 18 * Math.min(ctx, 128));

export function step(ctx: number, B = 1) {
  const experts = touched(B) * LAYERS * expertBytes;
  const kv = kvRead(ctx) * B;
  const bytes = attnW + unembW + experts + kv;
  const flops = flopsTok(ctx) * B;
  return { attn: attnW, unemb: unembW, experts, kv, bytes, flops, time: bytes / BW, intensity: flops / bytes };
}

export const GB = (b: number) => `${(b / 1e9).toFixed(2)} GB`;
export const MiB = (b: number) => `${(b / 2 ** 20).toFixed(0)} MiB`;
export const KiB = (b: number) => `${(b / 1024).toFixed(0)} KiB`;
export const ms = (s: number) => `${(s * 1000).toFixed(2)} ms`;
export const n = (v: number) => Math.round(v).toLocaleString('en-US');

/** The worked example: one user, a 4,085-token prompt. Tokens are illustrative. */
export const PROMPT = 4085;
export const answer = ['The', ' pod', ' is', ' pending'];
export const steps = [1, 2, 3, 4].map((t) => ({ t, ctx: PROMPT + t - 1, token: answer[t - 1], ...step(PROMPT + t - 1) }));
/** Later in the same answer. */
export const later = [1000, 28683].map((t) => ({ t, ctx: PROMPT + t - 1, ...step(PROMPT + t - 1) }));

/** Bars of one step's bytes (GB axis). */
export function byteBar(s: ReturnType<typeof step>, hi?: 'w' | 'e' | 'kv') {
  let x = 0;
  const seg = (v: number, tone: string, text: string, h: boolean) => { const r = { from: x / 1e9, to: (x + v) / 1e9, tone, text, hi: h }; x += v; return r; };
  return [{
    label: 'Bytes read',
    segs: [
      seg(s.attn, 'violet', 'attention W', hi === 'w'),
      seg(s.experts, 'peach', '4 experts × 36', hi === 'e'),
      seg(s.unemb, 'primary', 'unembed', hi === 'w'),
      seg(s.kv, 'note', s.kv > 3e8 ? `KV ${MiB(s.kv)}` : '', hi === 'kv'),
    ],
  }];
}

/** Rows of the batching tables (each user at a 4k context). */
export const BATCHES = [1, 16, 64, 256].map((B) => ({ B, ...step(4096, B), ex: touched(B) }));
export const LLAMA_W = 141e9, LLAMA_KV = 80 * 2 * 8 * 128 * 2;
export const llama = [1, 16, 64].map((B) => { const bytes = LLAMA_W + LLAMA_KV * 4096 * B; return { B, bytes, time: bytes / BW }; });
