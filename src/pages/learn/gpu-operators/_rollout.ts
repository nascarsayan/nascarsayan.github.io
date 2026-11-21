/**
 * DRA driver rollout across the example cluster's 4 GPU nodes, computed. Strategy
 * is the operator's default: RollingUpdate, maxUnavailable 1, maxSurge 0.
 * Node and Pod names are illustrative. The DaemonSet controller does not promise
 * an order; name order of the nodes is used here.
 */

export const nodes = ['gpu-node-1', 'gpu-node-2', 'gpu-node-3', 'gpu-node-4'];
export const draPods: Record<string, string> = {
  'gpu-node-1': 'default-dra-driver-aaaa1', 'gpu-node-2': 'default-dra-driver-bbbb2',
  'gpu-node-3': 'default-dra-driver-cccc3', 'gpu-node-4': 'default-dra-driver-dddd4',
};
export const short = (n: string) => n;
export const gpusPerNode = 8;

/** Batches of nodes replaced together for a given maxUnavailable (maxSurge 0: delete first, then create). */
export const batches = (maxUnavailable: number) => {
  const out: string[][] = [];
  for (let i = 0; i < nodes.length; i += maxUnavailable) out.push(nodes.slice(i, i + maxUnavailable));
  return out;
};

/** State grid for a Matrix: rows = nodes, cols = start, round 1..R, done. 0 old, −1 no driver, 1 new. */
export const grid = (maxUnavailable = 1) => {
  const b = batches(maxUnavailable);
  const cols = ['start', ...b.map((_, i) => `r${i + 1}`), 'done'];
  const data = nodes.map((n) => {
    const k = b.findIndex((x) => x.includes(n));
    return cols.map((_, c) => (c === 0 ? 0 : c === cols.length - 1 ? 1 : c - 1 < k ? 0 : c - 1 === k ? -1 : 1));
  });
  return { cols, rows: nodes.map(short), data };
};
export const g1 = grid(1);
export const rounds1 = batches(1).length;

/** Numbers used by the walkthrough. */
export const graceSeconds = 30;          // terminationGracePeriodSeconds of the DaemonSet
export const startMs = 800;              // illustrative podStartE2EDuration of a DRA driver Pod
export const wipeSeconds = 30;           // kubelet wipes a node's slices 30 s after its plugin goes away
