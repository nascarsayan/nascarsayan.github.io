/**
 * Rack-scale arithmetic for this page, computed at build time from vendor line
 * rates (approximate; ideal transfers, no protocol overhead).
 */
export const links = [
  { id: 'nvlink5', label: 'NVLink 5, one Blackwell GPU (0.9 TB/s each way)', GBps: 900, kind: 'scale-up' },
  { id: 'ualoe', label: 'Helios UALoE, one MI455X (≈ 1.8 TB/s each way, from AMD\'s 260 TB/s rack figure)', GBps: 1800, kind: 'scale-up' },
  { id: 'cx8', label: 'ConnectX-8 800 Gb/s NIC (100 GB/s)', GBps: 100, kind: 'scale-out' },
  { id: 'vulcano', label: 'Vulcano 800 Gb/s NIC (100 GB/s)', GBps: 100, kind: 'scale-out' },
  { id: 'cx7', label: 'ConnectX-7 400 Gb/s NIC, MI355X (50 GB/s)', GBps: 50, kind: 'scale-out' },
];
const ms = (gb: number, GBps: number) => (gb / GBps) * 1000;
export const nv = {
  gpus: 72, trays: 18, perTray: 4, nvlinkBidiTBps: 1.8,
  aggTBps: Math.round(72 * 1.8 * 10) / 10,          // 129.6
  move10GB: { nvlink: Math.round(ms(10, 900)), nic: Math.round(ms(10, 100)) },
  ratio: Math.round(900 / 100),
  scaleOutTbps: (72 * 800) / 1000,                    // 57.6
};
/** A 2-Pod ComputeDomain: which trays, GPUs and what fails when one tray goes. */
export const cd = { pods: 2, gpusPerPod: 4, trays: ['tray 3', 'tray 7'], gpus: 8, lostIfTrayFails: 4 };
