/**
 * Link speeds and the worked KV-cache move, computed at build time so every
 * time on the page is exact arithmetic on the figures below.
 * All speeds are vendor peak figures, one direction, decimal GB/s (approximate).
 */
export interface Link { id: string; label: string; gbps: number; vendor: 'AMD' | 'NVIDIA' | 'both'; note: string }

export const links: Link[] = [
  { id: 'hbm', label: 'HBM (read once)', gbps: 8000, vendor: 'both', note: 'MI355X and Blackwell Ultra: 8 TB/s' },
  { id: 'nvl5', label: 'NVLink 5 (all 18 links)', gbps: 900, vendor: 'NVIDIA', note: '1.8 TB/s both ways, per GPU' },
  { id: 'xgmi7', label: 'XGMI, all 7 links', gbps: 504, vendor: 'AMD', note: '7 × 72 GB/s, spread over 7 peers' },
  { id: 'c2c', label: 'NVLink-C2C to Grace', gbps: 450, vendor: 'NVIDIA', note: 'GB300: 900 GB/s both ways' },
  { id: 'pcie6', label: 'PCIe Gen6 x16', gbps: 128, vendor: 'NVIDIA', note: 'HGX B300 host link' },
  { id: 'cx8', label: 'ConnectX-8, 800 Gb/s', gbps: 100, vendor: 'NVIDIA', note: 'one NIC per GPU in NVL72' },
  { id: 'xgmi1', label: 'XGMI, one link', gbps: 72, vendor: 'AMD', note: 'to one neighbour GPU' },
  { id: 'pcie5', label: 'PCIe Gen5 x16', gbps: 64, vendor: 'AMD', note: 'GPU ↔ host, GPU ↔ NIC' },
  { id: 'cx7', label: 'ConnectX-7, 400 Gb/s', gbps: 50, vendor: 'AMD', note: 'one NIC per GPU' },
];
export const byId = Object.fromEntries(links.map((l) => [l.id, l])) as Record<string, Link>;

/** gpt-oss-120b, naive (every layer keeps every token), 16-bit: 2 × 36 layers × 8 KV heads × 64 × 2 B. */
export const kvPerToken = 2 * 36 * 8 * 64 * 2; // 73,728 B = 72 KiB
export const promptTokens = 4085; // an example prompt length
export const kvBytes = kvPerToken * promptTokens; // 301,178,880 B

/** Seconds to move `bytes` over a link at `eff` (0..1) of its peak. */
export const seconds = (bytes: number, gbps: number, eff = 1) => bytes / (gbps * 1e9 * eff);
export const fmtTime = (s: number) =>
  s >= 1 ? `${s.toFixed(2)} s` : s >= 1e-3 ? `${(s * 1e3).toFixed(s >= 0.1 ? 0 : s >= 0.01 ? 1 : 2)} ms` : `${(s * 1e6).toFixed(1)} µs`;
export const fmtBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(0)} MB`);

const t = (id: string) => seconds(kvBytes, byId[id].gbps);
/** The worked example's times: one KV cache over each route. */
export const kv = {
  bytes: fmtBytes(kvBytes),
  mib: (kvBytes / 2 ** 20).toFixed(0),
  perToken: `${kvPerToken / 1024} KiB`,
  hbm: fmtTime(t('hbm')),
  xgmi1: fmtTime(t('xgmi1')),
  xgmi7: fmtTime(t('xgmi7')),
  pcie5: fmtTime(t('pcie5')),
  nic: fmtTime(t('cx7')),
  bounce: fmtTime(t('pcie5') + t('cx7')),
  cx8: fmtTime(t('cx8')),
  /** How many times slower than reading it from HBM. */
  ratio: (id: string) => Math.round(t(id) / t('hbm')),
  ratioBounce: Math.round((t('pcie5') + t('cx7')) / t('hbm')),
  pcieBytesBounce: fmtBytes(kvBytes * 2),
};

/** Rows for the per-route bar strips: label, seconds. */
export const route = (ids: string[]) => ids.map((id) => ({ label: byId[id].label, s: t(id) }));

/** The routes of the worked example, as bar rows; `hi` marks the step's own route(s). */
const routes = [
  { id: 'hbm', label: 'Read from HBM', s: t('hbm') },
  { id: 'xgmi7', label: 'XGMI, split over 7 peers', s: t('xgmi7') },
  { id: 'xgmi1', label: 'XGMI, one neighbour', s: t('xgmi1') },
  { id: 'pcie5', label: 'PCIe Gen5 to host RAM', s: t('pcie5') },
  { id: 'cx7', label: 'NIC, GPUDirect', s: t('cx7') },
  { id: 'bounce', label: 'NIC, bounced via host RAM', s: t('pcie5') + t('cx7') },
];
export const kvTop = t('pcie5') + t('cx7');
export const kvRows = (...hi: string[]) => routes.map((r) => ({ label: r.label, s: r.s, hi: hi.includes(r.id) }));
