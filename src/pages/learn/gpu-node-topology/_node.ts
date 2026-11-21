/**
 * Illustrative MI355X server map for the synthetic example node `gpu-node-1`
 * (made-up but realistic values: amd-smi list, sysfs paths, numa_node, lscpu,
 * the gpu.amd.com ResourceSlice). Tables and the walkthrough are generated from this.
 * Sysfs paths are simplified: the switch's internal downstream ports are omitted.
 */
export interface Slice {
  gpu: number; bdf: string; numa: number; cores: string; root: string;
  mlx: string; nicBdf: string; netdev: string; dra: string;
  gpuPath: string; nicPath: string;
}

export const slices: Slice[] = [
  { gpu: 0, bdf: '0000:11:00.0', numa: 0, cores: '0–63, 128–191', root: 'pci0000:00', mlx: 'rdma0', nicBdf: '0000:12:00.0', netdev: 'ens1np0', dra: 'gpu-1-128',
    gpuPath: 'pci0000:00/0000:00:01.1/0000:10:00.0/0000:11:00.0', nicPath: 'pci0000:00/0000:00:01.1/0000:10:00.0/0000:12:00.0' },
  { gpu: 1, bdf: '0000:2f:00.0', numa: 0, cores: '0–63, 128–191', root: 'pci0000:20', mlx: 'rdma1', nicBdf: '0000:30:00.0', netdev: 'ens2np0', dra: 'gpu-2-129',
    gpuPath: 'pci0000:20/0000:20:01.1/0000:2e:00.0/0000:2f:00.0', nicPath: 'pci0000:20/0000:20:01.1/0000:2e:00.0/0000:30:00.0' },
  { gpu: 2, bdf: '0000:4d:00.0', numa: 0, cores: '0–63, 128–191', root: 'pci0000:40', mlx: 'rdma2', nicBdf: '0000:4e:00.0', netdev: 'ens3np0', dra: 'gpu-3-130',
    gpuPath: 'pci0000:40/0000:40:01.1/0000:4c:00.0/0000:4d:00.0', nicPath: 'pci0000:40/0000:40:01.1/0000:4c:00.0/0000:4e:00.0' },
  { gpu: 3, bdf: '0000:6b:00.0', numa: 0, cores: '0–63, 128–191', root: 'pci0000:60', mlx: 'rdma3', nicBdf: '0000:6c:00.0', netdev: 'ens4np0', dra: 'gpu-4-131',
    gpuPath: 'pci0000:60/0000:60:01.1/0000:6a:00.0/0000:6b:00.0', nicPath: 'pci0000:60/0000:60:01.1/0000:6a:00.0/0000:6c:00.0' },
  { gpu: 4, bdf: '0000:8b:00.0', numa: 1, cores: '64–127, 192–255', root: 'pci0000:80', mlx: 'rdma4', nicBdf: '0000:8c:00.0', netdev: 'ens5np0', dra: 'gpu-5-132',
    gpuPath: 'pci0000:80/0000:80:01.1/0000:8a:00.0/0000:8b:00.0', nicPath: 'pci0000:80/0000:80:01.1/0000:8a:00.0/0000:8c:00.0' },
  { gpu: 5, bdf: '0000:a9:00.0', numa: 1, cores: '64–127, 192–255', root: 'pci0000:a0', mlx: 'rdma5', nicBdf: '0000:aa:00.0', netdev: 'ens6np0', dra: 'gpu-6-133',
    gpuPath: 'pci0000:a0/0000:a0:01.1/0000:a8:00.0/0000:a9:00.0', nicPath: 'pci0000:a0/0000:a0:01.1/0000:a8:00.0/0000:aa:00.0' },
  { gpu: 6, bdf: '0000:c7:00.0', numa: 1, cores: '64–127, 192–255', root: 'pci0000:c0', mlx: 'rdma6', nicBdf: '0000:c8:00.0', netdev: 'ens7np0', dra: 'gpu-7-134',
    gpuPath: 'pci0000:c0/0000:c0:01.1/0000:c6:00.0/0000:c7:00.0', nicPath: 'pci0000:c0/0000:c0:01.1/0000:c6:00.0/0000:c8:00.0' },
  { gpu: 7, bdf: '0000:e5:00.0', numa: 1, cores: '64–127, 192–255', root: 'pci0000:e0', mlx: 'rdma7', nicBdf: '0000:e6:00.0', netdev: 'ens8np0', dra: 'gpu-8-135',
    gpuPath: 'pci0000:e0/0000:e0:01.1/0000:e4:00.0/0000:e5:00.0', nicPath: 'pci0000:e0/0000:e0:01.1/0000:e4:00.0/0000:e6:00.0' },
];

/** Socket from the PCI bus number: buses 00–7f hang off CPU 0, 80–ff off CPU 1. */
export const socket = (s: Slice) => (parseInt(s.bdf.split(':')[1], 16) >= 0x80 ? 1 : 0);

/** Longest common run of path components: the deepest bridge both devices sit under. */
export const commonPrefix = (a: string, b: string) => {
  const x = a.split('/'), y = b.split('/');
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return x.slice(0, i);
};

/** How far a NIC is from a GPU: same PCIe switch (NVIDIA's PIX), same CPU socket, or across sockets. */
export const distance = (g: Slice, n: Slice) => {
  if (socket(g) !== socket(n)) return 'other CPU socket';
  // Shared root, root port and switch upstream port = under one switch.
  return commonPrefix(g.gpuPath, n.nicPath).length >= 3 ? 'same PCIe switch' : 'same socket, other root complex';
};

/** Split a sysfs path at the common prefix with another, for display. */
export const splitPath = (path: string, other: string) => {
  const parts = path.split('/');
  const n = commonPrefix(path, other).length;
  return { shared: parts.slice(0, n).join('/'), rest: parts.slice(n).join('/') };
};

export const g5 = slices[5];
export const g5Split = splitPath(g5.gpuPath, g5.nicPath);
export const n5Split = splitPath(g5.nicPath, g5.gpuPath);
/** The switch upstream port both sit under: the last shared component. */
export const g5Switch = commonPrefix(g5.gpuPath, g5.nicPath).at(-1)!;
/** Of the 8 NICs, which share how much of GPU 5's path. */
export const g5Candidates = slices.map((s) => ({ mlx: s.mlx, shared: commonPrefix(g5.gpuPath, s.nicPath).length, dist: distance(g5, s) }));
