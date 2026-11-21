/**
 * Small floating-point formats, encoded exactly (round to nearest, ties to even).
 * Used at build time for the worked examples and in the browser by _FpEncoder.astro.
 *
 * Overflow: IEEE-style formats (FP32, BF16, FP16, E5M2) round to infinity.
 * Formats without infinity (E4M3, FP6, FP4) saturate to their largest value,
 * which is what quantizers do (OCP MX spec: conversion with saturation).
 */
export interface Fmt {
  id: string;
  name: string;
  e: number; // exponent bits
  m: number; // mantissa bits
  bias: number;
  /** 'ieee': top exponent = inf/NaN. 'e4m3': only S.1111.111 is NaN. 'none': every pattern is a number. */
  special: 'ieee' | 'e4m3' | 'none';
}

export const FORMATS: Fmt[] = [
  { id: 'fp32', name: 'FP32', e: 8, m: 23, bias: 127, special: 'ieee' },
  { id: 'bf16', name: 'BF16', e: 8, m: 7, bias: 127, special: 'ieee' },
  { id: 'fp16', name: 'FP16', e: 5, m: 10, bias: 15, special: 'ieee' },
  { id: 'e4m3', name: 'FP8 E4M3', e: 4, m: 3, bias: 7, special: 'e4m3' },
  { id: 'e5m2', name: 'FP8 E5M2', e: 5, m: 2, bias: 15, special: 'ieee' },
  { id: 'e2m3', name: 'FP6 E2M3', e: 2, m: 3, bias: 1, special: 'none' },
  { id: 'e3m2', name: 'FP6 E3M2', e: 3, m: 2, bias: 3, special: 'none' },
  { id: 'e2m1', name: 'FP4 E2M1', e: 2, m: 1, bias: 1, special: 'none' },
];
export const fmt = (id: string) => FORMATS.find((f) => f.id === id)!;

/** Largest finite value. */
export const maxOf = (f: Fmt) => {
  const topE = (1 << f.e) - 1;
  const eField = f.special === 'ieee' ? topE - 1 : topE;
  const mField = f.special === 'e4m3' ? (1 << f.m) - 2 : (1 << f.m) - 1;
  return 2 ** (eField - f.bias) * (1 + mField / 2 ** f.m);
};
/** Smallest positive normal and subnormal values. */
export const minNormal = (f: Fmt) => 2 ** (1 - f.bias);
export const minSub = (f: Fmt) => 2 ** (1 - f.bias - f.m);

const floorLog2 = (a: number) => {
  let e = Math.floor(Math.log2(a));
  while (2 ** e > a) e--;
  while (2 ** (e + 1) <= a) e++;
  return e;
};
const roundEven = (q: number) => {
  const f = Math.floor(q), d = q - f;
  return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1;
};

export interface Enc {
  sign: number;
  exp: number; // exponent field
  man: number; // mantissa field
  value: number; // decoded value (±Infinity or NaN possible)
  kind: 'zero' | 'subnormal' | 'normal' | 'inf' | 'nan' | 'saturated' | 'flushed';
  /** Unbiased exponent used (for normal numbers), else the subnormal exponent. */
  pow: number;
}

/** Encode x in format f. */
export function encode(x: number, f: Fmt): Enc {
  const sign = x < 0 || Object.is(x, -0) ? 1 : 0;
  const topE = (1 << f.e) - 1, topM = (1 << f.m) - 1;
  const emin = 1 - f.bias;
  if (Number.isNaN(x)) {
    if (f.special === 'none') return { sign: 0, exp: 0, man: 0, value: NaN, kind: 'nan', pow: 0 };
    return { sign, exp: topE, man: f.special === 'e4m3' ? topM : 1 << (f.m - 1), value: NaN, kind: 'nan', pow: 0 };
  }
  const a = Math.abs(x);
  const max = maxOf(f);
  const inf = (): Enc => ({ sign, exp: topE, man: 0, value: sign ? -Infinity : Infinity, kind: 'inf', pow: 0 });
  const sat = (): Enc => { const r = bits(max, f); return { ...r, sign, value: sign ? -max : max, kind: 'saturated' }; };
  if (a === Infinity) return f.special === 'ieee' ? inf() : sat();
  if (a === 0) return { sign, exp: 0, man: 0, value: sign ? -0 : 0, kind: 'zero', pow: emin };
  const e = Math.max(floorLog2(a), emin);
  const quantum = 2 ** (e - f.m);
  const v = roundEven(a / quantum) * quantum;
  if (v > max) return f.special === 'ieee' ? inf() : sat();
  if (v === 0) return { sign, exp: 0, man: 0, value: sign ? -0 : 0, kind: 'flushed', pow: emin };
  const r = bits(v, f);
  return { ...r, sign, value: sign ? -v : v };
}

function bits(v: number, f: Fmt): Omit<Enc, 'sign'> {
  const emin = 1 - f.bias;
  const e = floorLog2(v);
  if (e < emin) return { exp: 0, man: Math.round(v / 2 ** (emin - f.m)), value: v, kind: 'subnormal', pow: emin };
  return { exp: e + f.bias, man: Math.round((v / 2 ** e - 1) * 2 ** f.m), value: v, kind: 'normal', pow: e };
}

export const bin = (n: number, w: number) => n.toString(2).padStart(w, '0');
/** "0 | 0101 | 010" style bit string. */
export const bitText = (r: Enc, f: Fmt) => `${r.sign} ${bin(r.exp, f.e)} ${bin(r.man, f.m)}`;

/** Every non-negative value of a small format (for the FP4 / FP6 number lines). */
export const grid = (f: Fmt) => {
  const out: number[] = [];
  for (let e = 0; e < 1 << f.e; e++) for (let m = 0; m < 1 << f.m; m++) {
    if (f.special === 'ieee' && e === (1 << f.e) - 1) continue;
    if (f.special === 'e4m3' && e === (1 << f.e) - 1 && m === (1 << f.m) - 1) continue;
    out.push(e === 0 ? m * 2 ** (1 - f.bias - f.m) : 2 ** (e - f.bias) * (1 + m / 2 ** f.m));
  }
  return out;
};

/** Short decimal: up to `sig` significant digits, no trailing zeros. */
export const num = (v: number, sig = 6) => {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? 'NaN' : v > 0 ? '+∞' : '−∞';
  if (v === 0) return Object.is(v, -0) ? '−0' : '0';
  const a = Math.abs(v);
  const s = a >= 1e6 || a < 1e-4 ? v.toExponential(sig - 1).replace(/\.?0+e/, 'e') : String(Number(v.toPrecision(sig)));
  return s.replace('-', '−');
};
