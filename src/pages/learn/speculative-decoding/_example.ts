/**
 * Worked speculative-decoding round, computed at build time.
 * Toy vocabulary of 9 tokens; the target (p) and draft (q) distributions are
 * made up (a real model has ~200k tokens). Random numbers come from a fixed
 * seeded generator, so the page is the same on every build.
 */
type V = number[];

export const vocab = ['the', 'a', 'pod', 'node', 'is', 'was', 'ready', 'running', '.'];
export const context = ['kubectl', 'reports', 'that'];
export const k = 4;
/** Draft's proposed tokens d1..d4 (its top choice at each position). */
export const draft = ['the', 'pod', 'is', 'ready'];

const ix = (t: string) => vocab.indexOf(t);
const dist = (m: Record<string, number>): V => {
  const v = vocab.map((t) => m[t] ?? 0);
  const rest = 1 - v.reduce((a, b) => a + b, 0);
  const free = v.filter((x) => x === 0).length;
  return v.map((x) => (x === 0 ? rest / free : x));
};
/** Target distributions p1..p5: what gpt-oss would predict after each draft prefix. */
export const P: V[] = [
  dist({ the: 0.62, a: 0.25 }),
  dist({ pod: 0.55, node: 0.35 }),
  dist({ was: 0.48, is: 0.3, running: 0.08, ready: 0.06 }),
  dist({ ready: 0.5, running: 0.4 }),
  dist({ '.': 0.7 }),
];
/** Draft distributions q1..q4. */
export const Q: V[] = [
  dist({ the: 0.7, a: 0.2 }),
  dist({ pod: 0.6, node: 0.3 }),
  dist({ is: 0.55, was: 0.35 }),
  dist({ ready: 0.6, running: 0.3 }),
];

const r2 = (x: number) => Math.round(x * 100) / 100;
const argmax = (v: V) => v.indexOf(Math.max(...v));
export const r2m = (m: V[]) => m.map((r) => r.map(r2));

// ---------- Greedy acceptance ----------
export const greedy = (() => {
  const rows = draft.map((d, i) => {
    const top = vocab[argmax(P[i])];
    return { pos: i + 1, draft: d, target: top, ok: top === d };
  });
  const firstBad = rows.findIndex((r) => !r.ok);
  const accepted = firstBad < 0 ? k : firstBad;
  const emitted = [...draft.slice(0, accepted), firstBad < 0 ? vocab[argmax(P[k])] : rows[firstBad].target];
  return { rows, accepted, firstBad, emitted, checked: firstBad < 0 ? k : firstBad + 1 };
})();

// ---------- Sampling acceptance (min(1, p/q)) ----------
/** mulberry32: a tiny seeded PRNG, so the "random" numbers are fixed. */
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const sample = (v: V, u: number) => { let acc = 0; for (let i = 0; i < v.length; i++) { acc += v[i]; if (u < acc) return i; } return v.length - 1; };
const residual = (p: V, q: V) => { const m = p.map((x, i) => Math.max(0, x - q[i])); const z = m.reduce((a, b) => a + b, 0); return m.map((x) => x / z); };

export const SEED = 16;
export const sampled = (() => {
  const u = rng(SEED);
  const rows: { pos: number; draft: string; p: number; q: number; ratio: number; u: number; ok: boolean }[] = [];
  let reject = -1, extra = '', extraU = 0, resid: V | null = null;
  for (let i = 0; i < k; i++) {
    const d = ix(draft[i]);
    const ratio = Math.min(1, P[i][d] / Q[i][d]);
    const ui = u();
    rows.push({ pos: i + 1, draft: draft[i], p: r2(P[i][d]), q: r2(Q[i][d]), ratio: r2(ratio), u: r2(ui), ok: ui < ratio });
    if (ui >= ratio) { reject = i; resid = residual(P[i], Q[i]); extraU = u(); extra = vocab[sample(resid, extraU)]; break; }
  }
  if (reject < 0) { extraU = u(); extra = vocab[sample(P[k], extraU)]; }
  const accepted = reject < 0 ? k : reject;
  return { rows, reject, accepted, extra, extraU: r2(extraU), resid: resid && resid.map(r2), emitted: [...draft.slice(0, accepted), extra] };
})();

/** Per-position acceptance probability for a draft token sampled from q: Σ min(p, q). */
export const alphaPos = Q.map((q, i) => r2(q.reduce((a, x, j) => a + Math.min(x, P[i][j]), 0)));
export const alphaMean = r2(alphaPos.reduce((a, b) => a + b, 0) / alphaPos.length);

/**
 * Losslessness check: run the rule many times at position 1 (draft samples
 * from q1, accept with min(1, p/q), else sample the residual) and count what
 * comes out. It should match p1, not q1.
 */
export const TRIALS = 100000;
export const check = (() => {
  const u = rng(12345);
  const n = vocab.map(() => 0);
  for (let t = 0; t < TRIALS; t++) {
    const d = sample(Q[0], u());
    const out = u() < Math.min(1, P[0][d] / Q[0][d]) ? d : sample(residual(P[0], Q[0]), u());
    n[out]++;
  }
  return { emp: n.map((c) => Math.round((c / TRIALS) * 1000) / 1000) };
})();

// ---------- Speedup formula ----------
export const E = (a: number, kk: number) => (1 - a ** (kk + 1)) / (1 - a);
export const S = (a: number, kk: number, c: number) => E(a, kk) / (kk * c + 1);
export const table = [
  [0.6, 4], [0.8, 4], [0.8, 8], [0.9, 8], [0.5, 8], [alphaMean, 4],
].map(([a, kk]) => ({ a, k: kk, E: E(a, kk).toFixed(2), cost: (kk * 0.05 + 1).toFixed(2), S: S(a, kk, 0.05).toFixed(1) }));
