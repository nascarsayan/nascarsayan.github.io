/**
 * Illustrative driver probe of the 8 MI355X on the synthetic example node (gpu-node-1),
 * in the style of `journalctl -k -b -o short-monotonic` (seconds since the kernel started).
 * The stamps are made up; every duration on the page is computed from them.
 */
export interface Probe { bdf: string; init: number; psp: number; ras: number; vram: number; smu: number; part: number; xgmi: number; node: number; kfd: number; card: number; render: number }

export const moduleLoaded = 7.2; // "[drm] amdgpu version: 6.14.0.30100000" (example)

// card/render as /dev/dri/by-path would show them on the example node.
export const probes: Probe[] = [
  { bdf: '0000:11:00.0', init: 7.250000, psp: 7.255000, ras: 7.265000, vram: 7.266000, smu: 9.666000, part: 9.668000, xgmi: 9.918000, node: 2, kfd: 10.418000, card: 1, render: 128 },
  { bdf: '0000:2f:00.0', init: 11.251100, psp: 11.256100, ras: 11.266100, vram: 11.267100, smu: 13.687100, part: 13.689100, xgmi: 13.949100, node: 3, kfd: 14.449100, card: 2, render: 129 },
  { bdf: '0000:4d:00.0', init: 15.250900, psp: 15.255900, ras: 15.265900, vram: 15.266900, smu: 17.656900, part: 17.658900, xgmi: 17.903900, node: 0, kfd: 18.403900, card: 3, render: 130 },
  { bdf: '0000:6b:00.0', init: 19.250700, psp: 19.255700, ras: 19.265700, vram: 19.266700, smu: 21.696700, part: 21.698700, xgmi: 21.963700, node: 1, kfd: 22.463700, card: 4, render: 131 },
  { bdf: '0000:8b:00.0', init: 23.250500, psp: 23.255500, ras: 23.265500, vram: 23.266500, smu: 25.676500, part: 25.678500, xgmi: 25.933500, node: 6, kfd: 26.433500, card: 5, render: 132 },
  { bdf: '0000:a9:00.0', init: 27.250300, psp: 27.255300, ras: 27.265300, vram: 27.266300, smu: 29.646300, part: 29.648300, xgmi: 29.888300, node: 7, kfd: 30.388300, card: 6, render: 133 },
  { bdf: '0000:c7:00.0', init: 31.250100, psp: 31.255100, ras: 31.265100, vram: 31.266100, smu: 33.706100, part: 33.708100, xgmi: 33.978100, node: 4, kfd: 34.478100, card: 7, render: 134 },
  { bdf: '0000:e5:00.0', init: 35.251200, psp: 35.256200, ras: 35.266200, vram: 35.267200, smu: 37.687200, part: 37.689200, xgmi: 37.949200, node: 5, kfd: 38.449200, card: 8, render: 135 },
];

/** Phases of one probe, in order: [key, label, from, to]. */
export const phases = (p: Probe) => [
  { key: 'disc', label: 'IP discovery, PSP, RAS, VRAM', from: p.init, to: p.vram },
  { key: 'smu', label: 'Firmware load until SMU is up', from: p.vram, to: p.smu },
  { key: 'xgmi', label: 'Partition mode, XGMI hive join', from: p.smu, to: p.xgmi },
  { key: 'kfd', label: 'Compute (KFD) device ready', from: p.xgmi, to: p.kfd },
];

const ms = (s: number) => Math.round(s * 1000);
const sec = (s: number) => (Math.round(s * 100) / 100).toFixed(2);
export const g0 = probes[0];
export const fmt = { ms, sec };
export const d = {
  toDiscovery: ms(g0.init - moduleLoaded),
  pspAfter: ms(g0.psp - g0.init),
  rasAfter: ms(g0.ras - g0.init),
  vramAfter: ms(g0.vram - g0.init),
  smuWait: sec(g0.smu - g0.vram),
  smuShare: Math.round(((g0.smu - g0.vram) / (g0.kfd - g0.init)) * 100),
  xgmiAfter: ms(g0.xgmi - g0.part),
  kfdAfter: ms(g0.kfd - g0.xgmi),
  probe0: sec(g0.kfd - g0.init),
  gap: ms(probes[1].init - g0.kfd),
  first: sec(probes[0].init),
  last: sec(probes[7].kfd),
  total: sec(probes[7].kfd - probes[0].init),
  avg: sec(probes.reduce((s, p) => s + (p.kfd - p.init), 0) / probes.length),
  hive: '0x1111222233334444',
};
/** Rows for the per-GPU table. */
export const rows = probes.map((p, i) => [
  String(i), p.bdf, sec(p.init), sec(p.kfd), sec(p.kfd - p.init), sec(p.smu - p.vram), String(p.node), `card${p.card}`, `renderD${p.render}`,
]);
