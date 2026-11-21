/**
 * Worked examples for this page, computed at build time: one weight through
 * FP8 E4M3 bit by bit, and one 32-value block through MXFP4 (OCP MX v1.0
 * rule) and NVFP4 (two 16-value blocks with E4M3 scales). The 32 weights are
 * made up (seeded random, typical size for an LLM weight matrix), with one
 * outlier at index 13.
 */
import { encode, fmt, num, bin, maxOf, grid, type Fmt } from './_fp';

// ---------- One weight through FP8 E4M3 ----------
export const w = 0.3;
const E4M3 = fmt('e4m3');
const r = encode(w, E4M3);
const pow = Math.floor(Math.log2(w));
const frac = w / 2 ** pow; // 1.2
export const one = {
  sign: r.sign,
  pow,
  frac: num(frac, 6),
  expField: pow + E4M3.bias,
  expBits: bin(pow + E4M3.bias, 4),
  manExact: num((frac - 1) * 8, 6),
  man: r.man,
  manBits: bin(r.man, 3),
  value: r.value,
  decodeText: `(1 + ${r.man}/8) × 2^${pow} = ${num(1 + r.man / 8)} × ${num(2 ** pow)} = ${num(r.value)}`,
  errPct: num((Math.abs(r.value - w) / w) * 100, 2),
};
/** The same weight in every format: [format, bits, stored, error %]. */
export const allFormats = ['fp32', 'bf16', 'fp16', 'e4m3', 'e5m2', 'e2m3', 'e2m1'].map((id) => {
  const f = fmt(id), e = encode(w, f);
  return { name: f.name, bits: 1 + f.e + f.m, s: String(e.sign), e: bin(e.exp, f.e), m: bin(e.man, f.m), stored: num(e.value, 9), err: num((Math.abs(e.value - w) / w) * 100, 3) };
});

// ---------- One MXFP4 block of 32 ----------
let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const raw = Array.from({ length: 32 }, () => Math.round(gauss() * 0.006 * 1e4) / 1e4);
raw[13] = 0.0234; // one outlier
export const block = raw;
export const rows4 = (a: number[]) => [0, 1, 2, 3].map((i) => a.slice(i * 8, i * 8 + 8));
export const r4 = (a: number[], k = 4) => rows4(a.map((v) => Math.round(v * 10 ** k) / 10 ** k));

const FP4 = fmt('e2m1');
const EMAX_FP4 = 2; // largest FP4 exponent: 6 = 1.5 × 2²
export const amax = Math.max(...block.map(Math.abs));
export const amaxLog = Math.floor(Math.log2(amax));
export const sharedExp = amaxLog - EMAX_FP4; // OCP MX: floor(log2(amax)) − emax_elem
export const X = 2 ** sharedExp;
export const scaled = block.map((v) => v / X);
export const codes = scaled.map((v) => encode(v, FP4).value); // FP4 element values (−6…6)
export const decoded = codes.map((c) => c * X);
export const err = block.map((v, i) => decoded[i] - v);
const rel = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.reduce((s, v) => s + v * v, 0));
export const mx = {
  scaleText: `2^${sharedExp} = ${num(X, 6)}`,
  e8m0: bin(sharedExp + 127, 8), // E8M0 stores the exponent with bias 127
  zeros: codes.filter((c) => c === 0).length,
  sat: scaled.filter((v) => Math.abs(v) > 6).length,
  relErr: num(rel(decoded, block) * 100, 3),
  outlier: { v: num(block[13], 4), s: num(scaled[13], 4), c: codes[13], d: num(decoded[13], 6) },
  small: { i: 2, v: num(block[2], 4), s: num(scaled[2], 4), c: codes[2], d: num(decoded[2], 6), e: num((Math.abs(decoded[2] - block[2]) / Math.abs(block[2])) * 100, 2) },
  bits: 32 * 4 + 8,
  bytes: (32 * 4 + 8) / 8,
  bf16Bytes: 32 * 2,
};

// ---------- Same block with one scale for a whole tensor whose largest value is 16× bigger ----------
export const tensorAmax = 0.375; // an outlier somewhere else in the tensor
const Xt = 2 ** (Math.floor(Math.log2(tensorAmax)) - EMAX_FP4);
export const perTensor = block.map((v) => encode(v / Xt, FP4).value * Xt);
export const pt = { scaleText: `2^${Math.log2(Xt)} = ${num(Xt, 6)}`, zeros: perTensor.filter((v) => v === 0).length, relErr: num(rel(perTensor, block) * 100, 3) };

// ---------- NVFP4: two blocks of 16, E4M3 scale each, FP32 scale for the tensor ----------
const E4 = fmt('e4m3');
// One common recipe: tensor scale so the largest block scale lands at E4M3's max (448).
const sTensor = amax / (maxOf(FP4) * maxOf(E4));
export const nv = [0, 1].map((h) => {
  const part = block.slice(h * 16, h * 16 + 16);
  const am = Math.max(...part.map(Math.abs));
  const sBlock = encode(am / maxOf(FP4) / sTensor, E4).value; // stored E4M3 scale
  const s = sBlock * sTensor;
  const dec = part.map((v) => encode(v / s, FP4).value * s);
  return { amax: am, sBlock, scale: s, dec };
});
export const nvDecoded = [...nv[0].dec, ...nv[1].dec];
export const nvf = {
  relErr: num(rel(nvDecoded, block) * 100, 3),
  zeros: nvDecoded.filter((v) => v === 0).length,
  scales: nv.map((b) => `${num(b.sBlock, 4)} × ${num(sTensor, 4)} = ${num(b.scale, 4)}`),
  bits: 32 * 4 + 2 * 8, // plus one FP32 per tensor, negligible
};

// FP4 grid for the number line
export const fp4Grid = [-6, -4, -3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 4, 6];
export type { Fmt };

// ---------- Matrix throughput: FLOPs per clock per CU (CDNA 4 white paper, Table 1) × 256 CUs × 2.4 GHz ----------
const CUS = 256, CLK = 2.4e9;
export const rates = [
  { f: 'FP16 / BF16', perCU: 4096, spec: '2.5 PFLOPS' },
  { f: 'FP8 (OCP) / MXFP8', perCU: 8192, spec: '5 PFLOPS' },
  { f: 'MXFP6 / MXFP4', perCU: 16384, spec: '10.1 PFLOPS' },
].map((r) => ({ ...r, perCore: r.perCU / 4, peak: `${num((r.perCU * CUS * CLK) / 1e15, 3)} PFLOPS` }));

// Intuition: the values E4M3 can hold between 0 and 16, and the step size at a few points.
export const e4m3Ticks = grid(fmt('e4m3')).filter((v) => v <= 16);
export const e4m3Steps = [0.5, 1, 2, 4, 8].map((at) => ({ at, step: 2 ** (Math.floor(Math.log2(at)) - 3) }));
