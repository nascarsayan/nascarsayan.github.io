/**
 * Worked tiled GEMM, computed at build time: C (8 × 8) = A (8 × 8) · B (8 × 8),
 * workgroup tile 4 × 4 outputs, K-step 4. Small integers so every partial sum
 * is exact. The values are made up; the arithmetic is real.
 */
type M = number[][];
const N = 8, T = 4, KS = 4;
const gen = (f: (i: number, j: number) => number): M => Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => f(i, j)));
export const A: M = gen((i, j) => ((i * 3 + j * 5) % 4)); // 0..3
export const B: M = gen((i, j) => ((i * 7 + j * 2) % 5) - 2); // -2..2
const mul = (a: M, b: M): M => a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const add = (a: M, b: M): M => a.map((r, i) => r.map((v, j) => v + b[i][j]));
const sub = (m: M, r0: number, c0: number, h: number, w: number): M => m.slice(r0, r0 + h).map((r) => r.slice(c0, c0 + w));
export const C = mul(A, B);

/** The workgroup we follow: tile row 0, tile column 1 → C rows 0–3, columns 4–7. */
export const TR = 0, TC = 1;
export const rows = Array.from({ length: N }, (_, i) => `${i}`);
export const cols = rows;
const r0 = TR * T, c0 = TC * T;
export const tileRows = rows.slice(r0, r0 + T);
export const tileCols = cols.slice(c0, c0 + T);
export const kSteps = Array.from({ length: N / KS }, (_, s) => {
  const k0 = s * KS;
  const a = sub(A, r0, k0, T, KS), b = sub(B, k0, c0, KS, T);
  return { k0, kLabels: rows.slice(k0, k0 + KS), a, b, p: mul(a, b) };
});
export const acc1 = kSteps[0].p;
export const acc2 = add(acc1, kSteps[1].p);
export const cTile = sub(C, r0, c0, T, T);
export const tileOk = JSON.stringify(acc2) === JSON.stringify(cTile);

/** Cells to outline in the full matrices. */
const cells = (ra: number, rb: number, ca: number, cb: number) => {
  const out: [number, number][] = [];
  for (let i = ra; i < rb; i++) for (let j = ca; j < cb; j++) out.push([i, j]);
  return out;
};
export const hiA = (s: number | null) => (s === null ? cells(r0, r0 + T, 0, N) : cells(r0, r0 + T, s * KS, s * KS + KS));
export const hiB = (s: number | null) => (s === null ? cells(0, N, c0, c0 + T) : cells(s * KS, s * KS + KS, c0, c0 + T));
export const hiC = cells(r0, r0 + T, c0, c0 + T);
/** Workgroup id grid (2 × 2 tiles). */
export const wgGrid: M = [[0, 1], [2, 3]];

/** One output spelled out: C[0][4] over both K-steps. */
const i0 = r0, j0 = c0;
export const dot = (k0: number) => Array.from({ length: KS }, (_, k) => `${A[i0][k0 + k]}·${B[k0 + k][j0]}`).join(' + ');
export const part = (s: number) => kSteps[s].p[0][0];

/** Load counts for this toy (elements read from global memory). */
export const naiveLoads = N * N * 2 * N; // every output reads a row of A and a column of B
export const tiledLoadsPerWg = kSteps.length * (T * KS + KS * T);
export const wgs = (N / T) ** 2;
export const tiledLoads = wgs * tiledLoadsPerWg;
export const macs = N * N * N;
export const macsPerWg = T * T * N;
