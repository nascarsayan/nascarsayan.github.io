/**
 * Topology of the illustrative 8× MI355X example node (made-up values), shared
 * with the node-topology page: each GPU's PCIe root and switch upstream port are
 * the first and third components of its sysfs device path. Everything else is computed.
 */
import { slices, socket, commonPrefix } from '../gpu-node-topology/_node';
import { device } from '../k8s-gpu-allocation/_sample';

/** NIC → NetworkAttachmentDefinition name: one NAD per data NIC, data-net-N → ensNnp0. */
export const nadFor = (netdev: string) => `data-net-${netdev.replace(/^ens(\d+)np0$/, '$1')}`;

/** Each GPU with the NIC under the same PCIe switch (shared root, root port and switch upstream port). */
export const pairs = slices.map((g) => {
  const n = slices.find((x) => commonPrefix(g.gpuPath, x.nicPath).length >= 3)!;
  return {
    numa: g.numa, socket: socket(g), cpus: g.cores,
    gpu: g.dra, gpuPci: g.bdf,
    nic: n.netdev, rdma: n.mlx, nicPci: n.nicBdf, nad: nadFor(n.netdev),
    root: g.root, switch: g.gpuPath.split('/')[2],
    sameSwitch: g.gpuPath.split('/')[2] === n.nicPath.split('/')[2],
  };
});
export const allPaired = pairs.every((p) => p.sameSwitch);

/** The followed prefill Pod's GPU (the DRA device from the shared sample) and its neighbour NIC. */
export const podPair = pairs.find((p) => p.gpu === device)!;
/** A Pod of a second Deployment on the same node: its GPU on the other socket, its fixed NAD on podPair's socket. */
export const otherPair = pairs.find((p) => p.socket !== podPair.socket)!;
export const otherNad = pairs.find((p) => p.socket === podPair.socket && p.gpu !== podPair.gpu)!;
