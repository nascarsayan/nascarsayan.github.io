/**
 * One kernel launch, computed. Shape: the query projection of gpt-oss-120b
 * (hidden 2,880 -> 64 heads x 64 = 4,096) over a 4,085-token prompt, in BF16.
 * The tile size and threads per workgroup are ILLUSTRATIVE assumptions: the BLAS
 * library picks its own kernel per shape and GPU.
 * AQL field layout: hsa_kernel_dispatch_packet_t in ROCR-Runtime hsa.h.
 */
export const M = 4085, K = 2880, N = 4096, bytesPer = 2;
export const tile = 256, threads = 256, wave = 64;
export const xcds = 8, cusPerXcd = 32, cus = xcds * cusPerXcd;
export const peakBf16 = 2.5e15; // MI355X dense BF16, vendor peak, approximate

export const tilesM = Math.ceil(M / tile), tilesN = Math.ceil(N / tile);
export const wgs = tilesM * tilesN;
export const wavesPerWg = threads / wave;
export const gridX = wgs * threads;
export const perXcd = wgs / xcds, perCu = perXcd / cusPerXcd;
export const flops = 2 * M * N * K;
export const lastRows = M - (tilesM - 1) * tile;
export const fill = (M * N) / (tilesM * tile * tilesN * tile);
const GB = (b: number) => `${(b / 1e6).toFixed(1)} MB`;
export const bytes = { A: GB(M * K * bytesPer), B: GB(K * N * bytesPer), C: GB(M * N * bytesPer) };
export const peakUs = ((flops / peakBf16) * 1e6).toFixed(1);
export const gflop = (flops / 1e9).toFixed(1);
export const fillPct = (fill * 100).toFixed(1);
/** First workgroups and the XCD each lands on (round-robin in SPX). */
export const firstWgs = Array.from({ length: 16 }, (_, i) => ({ wg: i, xcd: i % xcds, tileRow: Math.floor(i / tilesN), tileCol: i % tilesN }));
/** Round-robin in SPX: XCD x gets workgroups x, x+8, x+16, … (first 5 columns shown). */
export const rr: number[][] = Array.from({ length: xcds }, (_, x) => Array.from({ length: 5 }, (_, j) => x + xcds * j));
export const rrCols = ['1st', '2nd', '3rd', '4th', '5th'];
export const xcdRows = Array.from({ length: xcds }, (_, x) => `XCD ${x}`);

// header bits (hsa.h): type [0:7], barrier [8], acquire fence scope [9:10], release fence scope [11:12]
const KERNEL_DISPATCH = 2, SCOPE_SYSTEM = 2;
export const header = KERNEL_DISPATCH | (0 << 8) | (SCOPE_SYSTEM << 9) | (SCOPE_SYSTEM << 11);
export const lds = 64 * 1024; // illustrative LDS (shared memory) per workgroup

export interface Field { name: string; off: number; size: number; value: string; note: string; group: 'hdr' | 'shape' | 'mem' | 'ptr' | 'res' }
const hex = (v: number, w = 4) => `0x${v.toString(16).padStart(w, '0')}`;
export const aql: Field[] = [
  { name: 'header', off: 0, size: 2, value: hex(header), note: 'type 2 = kernel dispatch; acquire and release fences at system scope (example)', group: 'hdr' },
  { name: 'setup', off: 2, size: 2, value: '1', note: 'grid dimensions: 1', group: 'hdr' },
  { name: 'workgroup_size_x', off: 4, size: 2, value: String(threads), note: 'threads per workgroup', group: 'shape' },
  { name: 'workgroup_size_y', off: 6, size: 2, value: '1', note: '', group: 'shape' },
  { name: 'workgroup_size_z', off: 8, size: 2, value: '1', note: '', group: 'shape' },
  { name: 'reserved0', off: 10, size: 2, value: '0', note: '', group: 'res' },
  { name: 'grid_size_x', off: 12, size: 4, value: gridX.toLocaleString('en-US'), note: `in threads: ${wgs} workgroups × ${threads}`, group: 'shape' },
  { name: 'grid_size_y', off: 16, size: 4, value: '1', note: '', group: 'shape' },
  { name: 'grid_size_z', off: 20, size: 4, value: '1', note: '', group: 'shape' },
  { name: 'private_segment_size', off: 24, size: 4, value: '0', note: 'scratch bytes per thread', group: 'mem' },
  { name: 'group_segment_size', off: 28, size: 4, value: lds.toLocaleString('en-US'), note: 'LDS bytes per workgroup', group: 'mem' },
  { name: 'kernel_object', off: 32, size: 8, value: '→ code', note: 'address of the kernel descriptor in the gfx950 code object', group: 'ptr' },
  { name: 'kernarg_address', off: 40, size: 8, value: '→ args', note: 'pointer to the arguments: addresses of A, B, C, and M, N, K', group: 'ptr' },
  { name: 'reserved2', off: 48, size: 8, value: '0', note: '', group: 'res' },
  { name: 'completion_signal', off: 56, size: 8, value: '→ signal', note: 'handle the CP decrements when the grid is done', group: 'ptr' },
];
