/**
 * The allocator's work on one example ResourceSlice (gpu-node-1 of the sample cluster),
 * computed at build time. Device order is the slice's own order, which is the
 * order the first-fit allocator walks. Selectors are written in CEL on the page;
 * here each one is mirrored by a JS predicate over the same attributes.
 */
import { usedOn, gpus } from '../k8s-gpu-allocation/_sample';

const memMi = 294912; // 288 GiB, as published by the example driver

export const node = 'gpu-node-1';
type Dev = { name: string; numa: number; pci: string; root: string; memMi: number; type: string; driverVersion: string };
// Slice order as the driver discovered and published the devices (example output).
// It is not index order: first fit walks this order, so it matters.
const order = ['gpu-3-130', 'gpu-4-131', 'gpu-5-132', 'gpu-6-133', 'gpu-7-134', 'gpu-8-135', 'gpu-1-128', 'gpu-2-129'];
export const slice: Dev[] = order.map((n) => gpus.find((g) => g.name === n)!).map((g) => ({ name: g.name, numa: g.numa, pci: g.pci, root: g.root, memMi, type: 'amdgpu', driverVersion: '6.14.0' }));

export const held = usedOn(node);
export const isHeld = (d: Dev) => held.includes(d.name);
export const memGiB = memMi / 1024;

const semverGt = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

/** Selectors a reader can try. `error` = the attribute does not exist: CEL evaluation error, allocation aborts. */
export const selectors: { id: string; label: string; cel: string; test?: (d: Dev) => boolean; error?: string }[] = [
  { id: 'class', label: 'Class only', cel: `device.driver == 'gpu.amd.com'`, test: () => true },
  { id: 'mem', label: '≥ 256 GiB memory', cel: `device.capacity["gpu.amd.com"].memory.compareTo(quantity("256Gi")) >= 0`, test: (d) => d.memMi >= 256 * 1024 },
  { id: 'numa', label: 'NUMA node 1', cel: `device.attributes["gpu.amd.com"].numaNode == 1`, test: (d) => d.numa === 1 },
  { id: 'segment', label: 'PCI bus ≥ 0x80', cel: `device.attributes["resource.kubernetes.io"].pciBusID >= "0000:80"`, test: (d) => d.pci >= '0000:80' },
  { id: 'driver', label: 'driver > 6.12.0', cel: `device.attributes["gpu.amd.com"].driverVersion.isGreaterThan(semver("6.12.0"))`, test: (d) => semverGt(d.driverVersion, '6.12.0') },
  { id: 'typo', label: 'Typo: numa_node', cel: `device.attributes["gpu.amd.com"].numa_node == 1`, error: 'no such key: numa_node' },
];

/** For each selector: per-device result, the free matches, and what first fit would pick now. */
export const results = selectors.map((s) => {
  const rows = slice.map((d) => ({ ...d, match: s.error ? null : s.test!(d), held: isHeld(d) }));
  const free = rows.filter((r) => r.match && !r.held);
  return { ...s, rows, matchCount: rows.filter((r) => r.match).length, free: free.map((r) => r.name), pick: free[0]?.name ?? null };
});

/** Constraint example: 2 GPUs that share resource.kubernetes.io/pcieRoot. Group the free devices by root. */
export const byRoot = Object.entries(
  slice.filter((d) => !isHeld(d)).reduce<Record<string, string[]>>((m, d) => ((m[d.root] ??= []).push(d.name), m), {}),
);
export const maxPerRoot = Math.max(...byRoot.map(([, v]) => v.length));
export const distinctRoots = new Set(slice.map((d) => d.root)).size;
export const distinctNuma = new Set(slice.map((d) => d.numa)).size;
