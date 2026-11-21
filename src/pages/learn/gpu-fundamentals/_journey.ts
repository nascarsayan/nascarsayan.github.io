/**
 * One prefill GPU, followed through the track. Inputs: gpt-oss-120b
 * (about 65 GB of weights; 72 KiB of KV per token, naive), a 4,096-token example prompt,
 * and MI355X / link figures from the track pages (approximate peaks).
 */
export const weightsGB = 65;
export const hbmGB = 288;
export const heldGB = Math.round(hbmGB * 0.86); // a serving engine reserving most of HBM up front (illustrative)
export const promptTokens = 4096;
export const kvPerTokenB = 2 * 36 * 8 * 64 * 2; // K and V × layers × KV heads × head size × BF16 bytes
export const kvB = promptTokens * kvPerTokenB;
const GBs = { hbm: 8000, pcie: 64, nic: 50, xgmi: 72 };
export const t = {
  loadS: weightsGB / GBs.pcie, // weights host → GPU over PCIe, once
  readMs: (weightsGB / GBs.hbm) * 1000, // all weights read once from HBM
  kvNicMs: (kvB / 1e9 / GBs.nic) * 1000,
  kvHbmUs: (kvB / 1e9 / GBs.hbm) * 1e6,
};
export const kvMB = kvB / 1e6;
export const pct = Math.round((weightsGB / hbmGB) * 100);
export const fmt = (v: number, d = 1) => v.toFixed(d);
