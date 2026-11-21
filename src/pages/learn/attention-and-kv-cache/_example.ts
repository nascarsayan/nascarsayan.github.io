/**
 * Worked attention example, computed at build time so every number on the page
 * is exact arithmetic. Toy sizes: d_model = 4, one head of size d = 4.
 * Prompt: The GPU is fast; decode adds "!" then ".".
 * The embeddings and weight matrices are made up (a real model learns them).
 */
type M = number[][];
const mul = (a: M, b: M): M => a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const T = (a: M): M => a[0].map((_, j) => a.map((r) => r[j]));
const r2 = (a: M): M => a.map((r) => r.map((v) => Math.round(v * 100) / 100));

export const prompt = ['The', 'GPU', 'is', 'fast'];
export const decoded = ['!', '.'];
export const tokens = [...prompt, ...decoded];
export const d = 4;

// Token embeddings x (one row per token).
export const X: M = [
  [0.2, 0.1, 0.0, 0.3],
  [0.9, 0.4, 0.8, 0.1],
  [0.1, 0.6, 0.2, 0.0],
  [0.7, 0.2, 0.9, 0.5],
  [0.3, 0.8, 0.1, 0.6],
  [0.1, 0.3, 0.4, 0.9],
];
export const Wq: M = [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 0], [0, 0, 1, 1]];
export const Wk: M = [[1, 0, 0, 1], [1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 1]];
export const Wv: M = [[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, 1, 1], [1, 0, 0, 2]];

const Xall = r2(X);
export const Q = r2(mul(Xall, Wq));
export const K = r2(mul(Xall, Wk));
export const V = r2(mul(Xall, Wv));

/** Prefill over the first n tokens: causal scores, weights, outputs. */
export function attend(n: number, rowsFrom = 0) {
  const q = Q.slice(rowsFrom, n), k = K.slice(0, n), v = V.slice(0, n);
  const raw = mul(q, T(k)).map((row, i) => row.map((s, j) => (j <= rowsFrom + i ? s / Math.sqrt(d) : null)));
  const w = raw.map((row) => {
    const ok = row.filter((x): x is number => x !== null);
    const m = Math.max(...ok);
    const e = row.map((x) => (x === null ? 0 : Math.exp(x - m)));
    const z = e.reduce((a, b) => a + b, 0);
    return e.map((x, j) => (row[j] === null ? null : x / z));
  });
  const out = w.map((row) => v[0].map((_, c) => row.reduce<number>((s, x, j) => s + (x ?? 0) * v[j][c], 0)));
  const round = (a: (number | null)[][]) => a.map((r) => r.map((x) => (x === null ? null : Math.round(x * 100) / 100)));
  return { scores: round(raw), weights: round(w), out: round(out) as M };
}

export const pre = attend(4);          // prefill: 4 query rows over 4 keys
export const step5 = attend(5, 4);      // decode "!": 1 query row over 5 keys
export const step6 = attend(6, 5);      // decode ".": 1 query row over 6 keys
export const dims = ['d1', 'd2', 'd3', 'd4'];

/** Unmasked prefill scores Q·Kᵀ/√d (step 3, before the mask). */
export const rawPre: M = r2(mul(Q.slice(0, 4), T(K.slice(0, 4))).map((r) => r.map((v) => v / Math.sqrt(d))));
export const KT4: M = T(K.slice(0, 4));

const f = (v: number) => String(Math.round(v * 100) / 100);
/** "a·b + c·d … = s" for row i of A against row j of B (the dot product shown in the text). */
export const dotText = (A: M, i: number, B: M, j: number, div = 1) => {
  const terms = A[i].map((a, c) => `${f(a)}·${f(B[j][c])}`).join(' + ');
  const s = A[i].reduce((acc, a, c) => acc + a * B[j][c], 0) / div;
  return `(${terms})${div !== 1 ? ` ÷ ${div}` : ''} = ${f(s)}`;
};
/** Row i of X times a weight matrix, spelled out. */
export const projText = (i: number, W: M) =>
  X[i].map((x, k) => `${f(x)}·[${W[k].join(',')}]`).join(' + ') + ` = [${mul([X[i]], W)[0].map(f).join(', ')}]`;
