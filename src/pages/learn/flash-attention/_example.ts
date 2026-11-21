/**
 * Worked FlashAttention example, computed at build time: every number on the
 * page comes from this file. It reuses the toy model of the attention page
 * (/learn/attention-and-kv-cache/, same X, W_Q, W_K, W_V; d = 4, one head):
 * the six tokens "The GPU is fast ! ." and the query of the last token ".".
 * Keys and values are processed in blocks of 2, as a FlashAttention kernel
 * would process blocks of 64 or 128.
 */
type M = number[][];
const mul = (a: M, b: M): M => a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const r2 = (a: M): M => a.map((r) => r.map((v) => Math.round(v * 100) / 100));
const rnd = (v: number, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const f = (v: number, n = 2) => String(rnd(v, n)).replace('-', '−');

export const tokens = ['The', 'GPU', 'is', 'fast', '!', '.'];
export const dims = ['d1', 'd2', 'd3', 'd4'];
export const d = 4;
export const B = 2; // keys per block

// Same toy numbers as attention-and-kv-cache/_example.ts.
const X: M = [
  [0.2, 0.1, 0.0, 0.3],
  [0.9, 0.4, 0.8, 0.1],
  [0.1, 0.6, 0.2, 0.0],
  [0.7, 0.2, 0.9, 0.5],
  [0.3, 0.8, 0.1, 0.6],
  [0.1, 0.3, 0.4, 0.9],
];
const Wq: M = [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 0], [0, 0, 1, 1]];
const Wk: M = [[1, 0, 0, 1], [1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 1]];
const Wv: M = [[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, 1, 1], [1, 0, 0, 2]];
export const Q = r2(mul(X, Wq));
export const K = r2(mul(X, Wk));
export const V = r2(mul(X, Wv));

/** The query row we follow: the last token ".". */
export const qi = 5;
export const q = Q[qi];
/** Scores s_j = q · k_j / √d for all 6 keys (the kernel never stores this whole row). */
export const s = K.map((k) => k.reduce((a, v, c) => a + v * q[c], 0) / Math.sqrt(d));

export interface BlockStep {
  keys: string[];
  s: number[];       // this block's scores
  mOld: number;      // running max before (−∞ for the first block)
  mNew: number;
  scale: number;     // exp(mOld − mNew): factor applied to old l and o
  p: number[];       // exp(s_j − mNew)
  lOld: number;
  l: number;
  oOld: number[];
  o: number[];       // unnormalised accumulator
  out: number[];     // o / l so far (what you would get if the row ended here)
}

/** Online softmax over a list of key indices, in blocks of B. */
export function online(idx: number[], b = B) {
  let m = -Infinity, l = 0, o = [0, 0, 0, 0];
  const steps: BlockStep[] = [];
  for (let i = 0; i < idx.length; i += b) {
    const ks = idx.slice(i, i + b);
    const sb = ks.map((j) => s[j]);
    const mNew = Math.max(m, ...sb);
    const scale = m === -Infinity ? 0 : Math.exp(m - mNew);
    const p = sb.map((x) => Math.exp(x - mNew));
    const lNew = l * scale + p.reduce((a, x) => a + x, 0);
    const oNew = o.map((v, c) => v * scale + p.reduce((a, x, n) => a + x * V[ks[n]][c], 0));
    steps.push({ keys: ks.map((j) => tokens[j]), s: sb, mOld: m, mNew, scale, p, lOld: l, l: lNew, oOld: o, o: oNew, out: oNew.map((v) => v / lNew) });
    m = mNew; l = lNew; o = oNew;
  }
  return { steps, m, l, o, out: o.map((v) => v / l) };
}

export const all = [0, 1, 2, 3, 4, 5];
export const run = online(all);

/** Plain softmax attention over the whole row at once, for the check. */
const mx = Math.max(...s);
const e = s.map((x) => Math.exp(x - mx));
const z = e.reduce((a, b) => a + b, 0);
export const weights = e.map((x) => x / z);
export const plain = V[0].map((_, c) => weights.reduce((a, w, j) => a + w * V[j][c], 0));
export const maxDiff = Math.max(...plain.map((v, c) => Math.abs(v - run.out[c])));

/** Split-KV: two workgroups each take half the keys, then a merge kernel combines them. */
export const half1 = online([0, 1, 2], 3);
export const half2 = online([3, 4, 5], 3);
const mm = Math.max(half1.m, half2.m);
export const merge = {
  m: mm,
  a1: Math.exp(half1.m - mm),
  a2: Math.exp(half2.m - mm),
  l: half1.l * Math.exp(half1.m - mm) + half2.l * Math.exp(half2.m - mm),
  o: half1.o.map((v, c) => v * Math.exp(half1.m - mm) + half2.o[c] * Math.exp(half2.m - mm)),
};
export const mergeOut = merge.o.map((v) => v / merge.l);

// ---- Rounded views for <Matrix> and text ----
export const row = (a: number[], n = 2) => [a.map((v) => rnd(v, n))];
export const fmt = f;
/** "exp(1.23 − 2.34) = 0.33" for each score of a block. */
export const pText = (st: BlockStep) => st.s.map((x, n) => `exp(${f(x, 3)} − ${f(st.mNew, 3)}) = ${f(st.p[n], 3)}`).join(', ');
export const lText = (st: BlockStep) =>
  st.mOld === -Infinity
    ? `l = ${st.p.map((x) => f(x, 3)).join(' + ')} = ${f(st.l, 3)}`
    : `l = ${f(st.lOld, 3)} × ${f(st.scale, 3)} + ${st.p.map((x) => f(x, 3)).join(' + ')} = ${f(st.l, 3)}`;



/** Full causal score matrix of a 6-token prefill (what naive attention writes to HBM). */
export const S: (number | null)[][] = Q.map((qr, i) => K.map((k, j) => (j > i ? null : rnd(k.reduce((a, v, c) => a + v * qr[c], 0) / Math.sqrt(d)))));
