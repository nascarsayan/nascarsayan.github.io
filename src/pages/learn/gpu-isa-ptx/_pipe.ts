/**
 * Illustrative sizes for building axpy (one source file) with example toolchains
 * (CUDA 12.8, ROCm 7.0.0). Hex values are in the style of `readelf -S -W`,
 * `roc-obj-ls` and `stat`; the page shows decimal values computed here.
 */
const h = (x: string) => parseInt(x, 16);
const n = (v: number) => v.toLocaleString('en-US');

export const bytes = {
  source: 278,
  ptx: 1025,
  cubin: 3848,
  codeObject: 5632,
  nvText: h('200'),          // .text.axpy in the sm_90 cubin
  nvConst0: h('22c'),        // .nv.constant0.axpy: parameter bank
  amdSym: 132,               // axpy symbol size in the gfx950 code object
  amdNote: h('514'),         // .note: metadata (msgpack)
  amdKd: h('40'),            // .rodata: the 64-byte kernel descriptor axpy.kd
  nvFatbinObj: h('1128'),    // .nv_fatbin in axpy_nv.o (sm_90 cubin + compute_90 PTX)
  hipFatbinObj: h('2730'),   // .hip_fatbin in axpy_amd.o (gfx950 only)
  hipFatbinSo: h('4600'),    // .hip_fatbin in libaxpy_amd.so (gfx942 + gfx950)
};
/** SASS instructions in the sm_90 listing (without trailing NOP/BRA padding), each 16 bytes. */
export const sassCount = 19;
export const sassBytes = sassCount * 16;
/** AMDGCN instructions up to s_endpgm, from llvm-objdump. */
export const amdCount = 22;
/** Kernel parameters: offsets in NVIDIA constant bank 0 and in the AMD kernarg segment. */
export const params = [
  { name: 'a (float)', nv: '0x210', amd: '0x00' },
  { name: 'x (pointer)', nv: '0x218', amd: '0x08' },
  { name: 'y (pointer)', nv: '0x220', amd: '0x10' },
  { name: 'n (int)', nv: '0x228', amd: '0x18' },
];
export const fmt = Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, n(v)])) as Record<keyof typeof bytes, string>;
