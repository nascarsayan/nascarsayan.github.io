/**
 * MI355X counts for the chip zoom, from AMD's CDNA 4 white paper and the
 * rocminfo / KFD topology fields an MI355X reports; Blackwell Ultra from NVIDIA's
 * "Inside Blackwell Ultra" blog. Totals are computed, not typed.
 */
export const amd = {
  xcds: 8,
  iods: 2,
  cuPhysPerXcd: 36,
  cuPerXcd: 32,
  simdPerCu: 4,
  lanesPerSimd: 16,
  wave: 64,
  matrixPerCu: 4,
  ldsKB: 160,
  l2PerXcdMB: 4,
  infinityCacheMB: 256,
  hbmStacks: 8,
  hbmGBPerStack: 36,
  hbmBitsPerStack: 1024,
  pinGbps: 8,
  clockMHz: 2400,
  fp8PerCuPerClk: 8192, // CDNA 4 white paper, Table 1
};
export const cus = amd.xcds * amd.cuPerXcd;
export const cuPhys = amd.xcds * amd.cuPhysPerXcd;
export const simds = cus * amd.simdPerCu;
export const lanes = simds * amd.lanesPerSimd;
export const matrixCores = cus * amd.matrixPerCu;
export const hbmGB = amd.hbmStacks * amd.hbmGBPerStack;
export const hbmBits = amd.hbmStacks * amd.hbmBitsPerStack;
export const hbmGBs = (hbmBits * amd.pinGbps) / 8;
export const hbmGBsPerStack = (amd.hbmBitsPerStack * amd.pinGbps) / 8;
export const cyclesPerWave = amd.wave / amd.lanesPerSimd;
export const l2TotalMB = amd.xcds * amd.l2PerXcdMB;
export const fp8PerCoreClk = amd.fp8PerCuPerClk / amd.matrixPerCu;
export const fp8Peak = (amd.fp8PerCuPerClk * cus * amd.clockMHz * 1e6) / 1e15; // PFLOPS
export const maxWavesPerCu = 32; // rocminfo "Max Waves Per CU"
export const residentLanes = cus * maxWavesPerCu * amd.wave; // threads that can be resident at once
/** Bytes per FLOP balance: FLOPs the matrix cores can do per byte read from HBM. */
export const ridgeFp8 = Math.round((fp8Peak * 1e15) / (hbmGBs * 1e9));

export const nv = { dies: 2, gpcs: 8, sms: 160, cudaPerSm: 128, tensorPerSm: 4, tmemKB: 256, warp: 32 };
export const nvCuda = nv.sms * nv.cudaPerSm;
export const nvTensor = nv.sms * nv.tensorPerSm;

const fmt = (n: number) => n.toLocaleString('en-US');
export const f = fmt;
