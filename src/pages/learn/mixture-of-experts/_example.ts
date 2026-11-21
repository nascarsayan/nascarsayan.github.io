/**
 * Worked MoE examples, computed at build time.
 *
 * 1. Routing one token: gpt-oss-120b's real layout (128 experts, top 4) with a
 *    toy hidden size of 4 (real: 2,880). Router and expert weights come from a
 *    seeded pseudo-random generator, rounded to 1 decimal; a real model learns them.
 * 2. Expert load in a batch: each token picks 4 distinct experts. "uniform" is
 *    the page's simple model (random routing); "skewed" gives some experts a
 *    higher pick probability, to show hot experts. Both are simulations.
 */
type M = number[][];
const mul = (a: M, b: M): M => a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const rd = (v: number, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const f = (v: number) => String(rd(v)).replace('-', '−');

/** mulberry32: small deterministic PRNG, so the page is identical on every build. */
const prng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const E = 128, K = 4, d = 4;
export const dims = ['d1', 'd2', 'd3', 'd4'];

// ---- 1. Routing one token ----------------------------------------------------
const r1 = prng(7);
/** Router matrix, d × 128. */
export const Wr: M = Array.from({ length: d }, () => Array.from({ length: E }, () => rd(r1() * 2 - 1, 1)));
/** The token's normed hidden state entering the MoE block. */
export const x: number[] = [1.2, -0.4, 0.8, 0.6];
export const scores = mul([x], Wr)[0].map((v) => rd(v));
/** Scores laid out as 8 rows × 16 experts for the heatmap. */
export const grid = (v: (number | null)[], cols = 16) => Array.from({ length: v.length / cols }, (_, i) => v.slice(i * cols, i * cols + cols));
export const gridRows = Array.from({ length: E / 16 }, (_, i) => `${i * 16}–${i * 16 + 15}`);
export const gridCols = Array.from({ length: 16 }, (_, j) => `+${j}`);
export const top = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]).slice(0, K).map(([, i]) => i);
export const topCells = top.map((i) => [Math.floor(i / 16), i % 16] as [number, number]);
export const topScores = top.map((i) => scores[i]);
const ex = topScores.map((s) => Math.exp(s - Math.max(...topScores)));
export const weights = ex.map((v) => rd(v / ex.reduce((a, b) => a + b, 0)));
export const softText = () => {
  const m = Math.max(...topScores);
  return topScores.map((s) => `e^(${f(s)}−${f(m)}) = ${f(Math.exp(s - m))}`).join(', ');
};
export const scoreText = (e: number) => x.map((v, k) => `${f(v)}·${f(Wr[k][e])}`).join(' + ') + ` = ${f(scores[e])}`;
export const expertLabel = (i: number) => `expert ${i}`;

/** Each chosen expert: a toy SwiGLU, down( silu(x·G) * (x·U) ), 4 → 4 → 4. */
const silu = (z: number) => z / (1 + Math.exp(-z));
const r2 = prng(11);
const mat = () => Array.from({ length: d }, () => Array.from({ length: d }, () => rd(r2() * 2.4 - 1.2, 1)));
const experts = Array.from({ length: E }, () => ({ g: mat(), u: mat(), dn: mat() }));
export const outs: M = top.map((i) => {
  const { g, u, dn } = experts[i];
  const G = mul([x], g)[0], U = mul([x], u)[0];
  return mul([G.map((z, j) => silu(z) * U[j])], dn)[0].map((v) => rd(v));
});
export const mixed = dims.map((_, c) => rd(outs.reduce((s, o, k) => s + weights[k] * o[c], 0)));
export const mixText = (c: number) => outs.map((o, k) => `${f(weights[k])}·${f(o[c])}`).join(' + ') + ` = ${f(mixed[c])}`;

// ---- 2. Expert load in a batch ---------------------------------------------
/** Pick K distinct experts per token, with optional per-expert popularity. */
const route = (tokens: number, seed: number, pop?: number[]) => {
  const r = prng(seed);
  const load = new Array(E).fill(0);
  const p = pop ?? new Array(E).fill(1);
  for (let t = 0; t < tokens; t++) {
    const chosen = new Set<number>();
    while (chosen.size < K) {
      let u = r() * p.reduce((a, b, i) => a + (chosen.has(i) ? 0 : b), 0);
      for (let i = 0; i < E; i++) { if (chosen.has(i)) continue; u -= p[i]; if (u <= 0) { chosen.add(i); break; } }
    }
    chosen.forEach((i) => load[i]++);
  }
  return load;
};
/** Skew: a Zipf-like popularity over a shuffled expert order (simulated hot experts). */
const rs = prng(5);
const order = Array.from({ length: E }, (_, i) => i).sort(() => rs() - 0.5);
const skewPop = new Array(E).fill(0);
order.forEach((e, rank) => (skewPop[e] = 1 / (rank + 8)));

export const expected = (b: number) => E * (1 - (1 - K / E) ** b);
const stat = (load: number[]) => {
  const touched = load.filter((v) => v > 0).length;
  const tokens = load.reduce((a, b) => a + b, 0) / K;
  return { load, touched, max: Math.max(...load), mean: rd((tokens * K) / touched, 1), expected: rd(expected(tokens), 0) };
};
export const batches = [
  { b: 1, ...stat(route(1, 21)) },
  { b: 8, ...stat(route(8, 22)) },
  { b: 64, ...stat(route(64, 23)) },
  { b: 512, ...stat(route(512, 24)) },
];
export const skewed = { b: 512, ...stat(route(512, 24, skewPop)) };
/** Experts in gpt-oss-120b: 3 × 2,880 × 2,880 weights at 4.25 bits, per layer, per expert. */
export const expertBytes = (3 * 2880 * 2880 * 4.25) / 8;
export const stepGB = (touched: number) => rd((touched * 36 * expertBytes) / 1e9, 1);
