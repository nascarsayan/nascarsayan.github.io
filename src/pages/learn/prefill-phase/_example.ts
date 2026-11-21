/**
 * Numbers for the prefill page, computed at build time from the public
 * gpt-oss-120b config. Prompt sizes are illustrative. Spec-sheet peaks are
 * approximate (MI355X dense FP8 ≈ 5 PFLOP/s).
 */
export const PEAK = 5e15;
/** gpt-oss-120b: linear FLOPs per token (2 × ~4.5 B active non-embedding weights + unembedding of the last token ignored). */
export const LIN = 9e9;
const ATT = 4 * 64 * 64; // FLOPs per token per unit of context per layer (scores + weighted sum)
const FULL = 18, SLIDE = 18, WIN = 128;

/** Prefill FLOPs for `u` new tokens after `c` cached ones (causal, gpt-oss-120b). */
export function flops(c: number, u: number) {
  const n = c + u;
  const lin = LIN * u;
  const full = FULL * ATT * ((n * (n + 1)) / 2 - (c * (c + 1)) / 2);
  // sliding layers: position p attends to min(p, 128) tokens
  const sl = (p: number) => (p <= WIN ? (p * (p + 1)) / 2 : (WIN * (WIN + 1)) / 2 + (p - WIN) * WIN);
  const slide = SLIDE * ATT * (sl(n) - sl(c));
  return { lin, full, slide, total: lin + full + slide };
}

export const fmt = (v: number, d = 1) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
export const T = (v: number) => `${fmt(v / 1e12, 1)} TFLOP`;
/** Seconds → "x.x ms". */
export const ms = (s: number) => `${fmt(s * 1000, 1)} ms`;
/** KV for all prompt tokens, window-aware 16-bit: 18 full layers × 2 KiB per token + 18 sliding layers × ≤128 tokens. */
export const kvBytes = (n: number) => 18 * 2048 * n + 18 * 2048 * Math.min(n, WIN);
export const MiB = (b: number) => `${fmt(b / 2 ** 20, 0)} MiB`;
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const P = (v: number) => `${fmt(v / 1e15, 2)} PFLOP/s`;
export const n = (v: number) => v.toLocaleString('en-US');

/** The main worked example (illustrative): a 2,760-token prompt whose first 256 tokens are in the prefix cache. */
export const m = { prompt_tokens: 2760, cached_tokens: 256, uncached_tokens: 2504 };
export const mf = flops(m.cached_tokens, m.uncached_tokens);
/** An assumed share of peak for the worked example (real kernels reach well below spec). */
export const MFU = 0.3;

/** Chunked prefill of an illustrative 30,000-token prompt with an 8,192-token budget: one entry per engine step. */
export const BUDGET = 8192;
export const long = { prompt_tokens: 30000 };
export const chunks = (() => {
  const out: { i: number; from: number; to: number; tokens: number; flops: ReturnType<typeof flops>; attShare: number }[] = [];
  for (let done = 0, i = 1; done < long.prompt_tokens; i++) {
    const tokens = Math.min(BUDGET, long.prompt_tokens - done);
    const f = flops(done, tokens);
    out.push({ i, from: done, to: done + tokens, tokens, flops: f, attShare: (f.full + f.slide) / f.total });
    done += tokens;
  }
  return out;
})();
export const longF = flops(0, long.prompt_tokens);

/** Token bar for chunk k (1-based): cached history, current chunk, still to come. */
export function chunkBar(k: number) {
  return [{
    label: 'Prompt',
    segs: chunks.map((c) => ({
      from: c.from, to: c.to,
      tone: c.i < k ? 'note' : c.i === k ? 'pink' : 'muted',
      text: c.i < k ? 'in KV cache' : c.i === k ? `chunk ${c.i}: ${c.tokens.toLocaleString('en-US')}` : '',
      hi: c.i === k,
    })),
  }];
}
