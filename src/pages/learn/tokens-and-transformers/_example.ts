/**
 * One toy transformer layer, computed at build time so every number on the page
 * is exact arithmetic on the numbers shown before it. Each stage is rounded to
 * 2 decimals and the rounded values feed the next stage, so a reader can redo
 * any step by hand.
 *
 * Toy sizes: hidden size 4 (gpt-oss-120b: 2,880), one attention head, a dense
 * SwiGLU MLP of width 4, a 6-entry output vocabulary. The token ids are real
 * (gpt-oss tokenizer, see _tokens.ts); the embeddings and weights are made up.
 */
import { sentences, candidates } from './_tokens';

type M = number[][];
const mul = (a: M, b: M): M => a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const T = (a: M): M => a[0].map((_, j) => a.map((r) => r[j]));
const add = (a: M, b: M): M => a.map((r, i) => r.map((v, j) => v + b[i][j]));
const r2 = (a: M): M => a.map((r) => r.map((v) => Math.round(v * 100) / 100));
const f = (v: number) => (Math.round(v * 100) / 100).toString().replace('-', '−');

export const sentence = sentences[0];
export const toks = sentence.tokens;
/** Row labels: the token piece with its leading space shown as ␣. */
export const labels = toks.map((t) => t.text.replace(/^ /, '␣'));
export const ids = toks.map((t) => t.id);
export const dims = ['d1', 'd2', 'd3', 'd4'];
const d = 4;

/** Step 2: the embedding rows for these 6 ids (made up; a real row has 2,880 numbers). */
export const X0: M = [
  [0.5, -0.2, 0.1, 0.8],
  [1.2, 0.6, -0.4, 0.3],
  [0.9, 0.3, -0.8, 0.1],
  [-0.3, 0.7, 0.2, -0.5],
  [0.4, -0.6, 1.1, 0.2],
  [-0.1, 0.2, 0.3, 0.9],
];

/** RMSNorm with gain 1: each row divided by its root-mean-square. */
const rmsOf = (r: number[]) => Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length + 1e-5);
const rmsnorm = (a: M): M => a.map((r) => { const s = rmsOf(r); return r.map((v) => v / s); });
export const rms0 = X0.map((r) => Math.round(rmsOf(r) * 100) / 100);
export const N1 = r2(rmsnorm(X0));
export const rmsText = (i: number) => {
  const r = X0[i];
  return `√((${r.map((v) => `${f(v)}²`).join(' + ')}) ÷ 4) = ${f(rmsOf(r))}`;
};

/** Attention, one head, causal (the mechanism is on the attention page). */
const Wq: M = [[1, 0, 0, 1], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 1, 1]];
const Wk: M = [[1, 0, 1, 0], [0, 1, 0, 0], [0, 1, 1, 0], [1, 0, 0, 1]];
const Wv: M = [[0.5, 0, 0, 0], [0, 0.5, 0, 0], [0, 0, 0.5, 0], [0, 0, 0, 0.5]];
const Q = mul(N1, Wq), K = mul(N1, Wk), V = mul(N1, Wv);
const scores = mul(Q, T(K)).map((row, i) => row.map((s, j) => (j <= i ? s / Math.sqrt(d) : null)));
export const W: (number | null)[][] = scores.map((row) => {
  const ok = row.filter((x): x is number => x !== null);
  const m = Math.max(...ok);
  const e = row.map((x) => (x === null ? 0 : Math.exp(x - m)));
  const z = e.reduce((a, b) => a + b, 0);
  return row.map((x, j) => (x === null ? null : Math.round((e[j] / z) * 100) / 100));
});
export const Vr = r2(V);
export const A = r2(mul(W.map((r) => r.map((x) => x ?? 0)), Vr));
export const X1 = r2(add(X0, A));

/** MLP: SwiGLU, down( silu(gate·x) * (up·x) ), on the re-normed stream. */
export const N2 = r2(rmsnorm(X1));
const Wg: M = [[0.8, -0.5, 0.2, 0.1], [0.3, 0.9, -0.4, 0.2], [-0.2, 0.4, 0.7, -0.6], [0.5, 0.1, 0.3, 0.8]];
const Wu: M = [[0.6, 0.2, -0.3, 0.4], [-0.1, 0.7, 0.5, -0.2], [0.4, -0.3, 0.6, 0.1], [0.2, 0.5, -0.1, 0.7]];
const Wd: M = [[0.3, -0.2, 0.1, 0.4], [0.1, 0.4, -0.3, 0.2], [-0.2, 0.1, 0.5, -0.1], [0.4, 0.2, 0.1, -0.3]];
const silu = (z: number) => z / (1 + Math.exp(-z));
export const G = r2(mul(N2, Wg));
export const U = r2(mul(N2, Wu));
export const H = r2(G.map((r, i) => r.map((g, j) => silu(g) * U[i][j])));
export const F = r2(mul(H, Wd));
export const X2 = r2(add(X1, F));
export const siluText = (i: number, j: number) => `silu(${f(G[i][j])}) × ${f(U[i][j])} = ${f(silu(G[i][j]))} × ${f(U[i][j])} = ${f(silu(G[i][j]) * U[i][j])}`;

/** The last token's row through the layer: the residual stream, stage by stage. */
const last = toks.length - 1;
export const lastLabel = labels[last];
export const stream: M = [X0[last], A[last], X1[last], F[last], X2[last]];
export const streamRows = ['embedding x', '+ attention', '= x after attn', '+ MLP', '= x after layer'];

/** Final RMSNorm and the toy unembedding: 4 → 6 logits, one per candidate token. */
export const cand = candidates.map((c) => c.text.replace(/^ /, '␣').replace(/\n/g, '↵'));
export const candIds = candidates.map((c) => c.id);
export const hLast = r2(rmsnorm([X2[last]]));
const Wout: M = [
  [1.4, 0.6, 0.9, 0.2, -0.3, -0.6],
  [-0.5, 0.8, 0.1, 0.6, 0.4, 0.9],
  [0.7, 0.9, 0.3, -0.4, 0.2, -0.2],
  [1.1, 0.2, 0.6, 0.5, 0.9, -0.8],
];
export const logits = r2(mul(hLast, Wout))[0];
const softmax = (z: number[], t = 1) => { const m = Math.max(...z); const e = z.map((v) => Math.exp((v - m) / t)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
export const probs = softmax(logits).map((p) => Math.round(p * 1000) / 1000);
export const probsT = (t: number) => softmax(logits, t).map((p) => Math.round(p * 1000) / 1000);
export const best = logits.indexOf(Math.max(...logits));

/** "0.35 from “␣ready”, 0.30 from “The”, 0.21 from itself": the 3 largest weights of row i. */
export const weightsText = (i: number) =>
  W[i].map((w, j) => [w ?? 0, j] as const).sort((a, b) => b[0] - a[0]).slice(0, 3)
    .map(([w, j]) => `${w.toFixed(2)} from ${j === i ? 'itself' : `"${labels[j]}"`}`).join(', ');
