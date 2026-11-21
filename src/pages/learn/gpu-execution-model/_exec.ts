/**
 * Worked example: one wave64 runs illustrative gfx950 code for `branchy` (below),
 * computed at build time. Every mask, value and count on the page comes from here.
 *
 *   if (i < n) { float v = x[i]; if (v > 0) y[i] = a[i] * v; else y[i] = b[i] - v; }
 *
 * One workgroup of 64 threads (one wavefront), n = 40, a[i] = 2, b[i] = 1.
 * x[i] is a made-up mix of positive and negative numbers.
 */
export const LANES = 64;
export const n = 40;
export const A = 2;
export const B = 1;

const lane = [...Array(LANES).keys()];
const r1 = (v: number) => Math.round(v * 10) / 10;
/** x[i]: deterministic, mixed signs. */
export const x = lane.map((i) => r1(Math.sin(i * 1.7 + 0.4) * 5));

export type Mask = boolean[];
const and = (p: Mask, q: Mask) => p.map((b, k) => b && q[k]);
const andNot = (p: Mask, q: Mask) => p.map((b, k) => b && !q[k]);
const or = (p: Mask, q: Mask) => p.map((b, k) => b || q[k]);
const xor = (p: Mask, q: Mask) => p.map((b, k) => b !== q[k]);
export const count = (m: Mask) => m.filter(Boolean).length;

/** 64-bit mask as hex, lane 63 = most significant bit (how the ISA defines EXEC). */
export const hex = (m: Mask) => {
  let s = '';
  for (let nib = 15; nib >= 0; nib--) {
    let v = 0;
    for (let b = 3; b >= 0; b--) v = v * 2 + (m[nib * 4 + b] ? 1 : 0);
    s += v.toString(16).toUpperCase();
  }
  return `0x${s.slice(0, 8)}_${s.slice(8)}`;
};

// Step by step, exactly as the instructions do it.
export const all: Mask = lane.map(() => true);                       // wave starts: EXEC = all ones
export const vccBounds: Mask = lane.map((i) => n > i);               // v_cmp_gt_i32 vcc, s4(n), v0(i)
export const s23 = all;                                              // s_and_saveexec_b64 s[2:3], vcc: s[2:3] = old EXEC
export const inBounds = and(all, vccBounds);                         // ... EXEC = EXEC & vcc
// v_cmp_nlt_f32 vcc, 0, v2: "not (0 < x)". A compare writes 0 for lanes that are off.
export const vccElse: Mask = lane.map((i) => inBounds[i] && !(0 < x[i]));
export const elseSide = and(inBounds, vccElse);                      // s_and_saveexec_b64 s[0:1], vcc: EXEC = EXEC & vcc
export const thenSaved = xor(elseSide, inBounds);                    // s_xor_b64 s[0:1], exec, s[0:1]: lanes still to do
export const thenSide = andNot(thenSaved, elseSide);                 // s_andn2_saveexec_b64: EXEC = s[0:1] & ~EXEC
export const merged = or(thenSide, elseSide);                        // s_or_b64 exec, exec, s[0:1]

/** Per-lane register contents after each phase ('' = lane did not write). */
const show = (m: Mask, f: (i: number) => number | string) => lane.map((i) => (m[i] ? String(f(i)) : ''));
export const vals = {
  i: lane.map(String),
  x: show(inBounds, (i) => x[i]),
  elseY: show(elseSide, (i) => r1(B - x[i])),
  y: show(merged, (i) => (elseSide[i] ? r1(B - x[i]) : r1(A * x[i]))),
  thenY: show(thenSide, (i) => r1(A * x[i])),
};

/**
 * Divergence cost. Each side has 5 vector instructions in the listing
 * (v_mov, v_mov, v_lshl_add, global_load, v_sub or v_mul). Both sides are
 * issued one after the other, each for the whole wave, with some lanes off.
 */
export const VEC_PER_SIDE = 5;
export const sides = [
  { name: 'else side (b − x)', lanes: count(elseSide) },
  { name: 'then side (a × x)', lanes: count(thenSide) },
];
export const usefulPct = Math.round(((count(elseSide) + count(thenSide)) / (2 * LANES)) * 100);
export const nThen = count(thenSide);
export const nElse = count(elseSide);
export const nIn = count(inBounds);
/** First few lanes of each side, for the text. */
export const firstThen = lane.filter((i) => thenSide[i]).slice(0, 3);
export const firstElse = lane.filter((i) => elseSide[i]).slice(0, 3);
