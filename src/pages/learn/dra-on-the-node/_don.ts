/**
 * Illustrative example files from gpu-node-1 for the DRA-on-the-node walkthrough.
 * Values come from the shared (synthetic) sample snapshot. The gRPC request/response are
 * rebuilt from the kubelet and driver checkpoints (same fields, api.proto
 * k8s.io/kubelet/pkg/apis/dra/v1); they are not logged on the wire.
 */
import * as c from '../k8s-gpu-allocation/_sample';

const short = (u: string) => `${u.slice(0, 8)}…`;
export const device = c.gpus.find((g) => g.name === c.device)!;

export const discoveryLog = `I1101 08:00:00.100000 main.go:151] Feature gates: ContextualLogging=true
I1101 08:00:00.200000 discovery.go:136] Found full AMD GPU: gpu-3-130, compute type: spx, memory type: nps1
I1101 08:00:00.200100 discovery.go:136] Found full AMD GPU: gpu-4-131, compute type: spx, memory type: nps1
I1101 08:00:00.200200 discovery.go:136] Found full AMD GPU: gpu-5-132, compute type: spx, memory type: nps1
…
I1101 08:00:00.201000 discovery.go:177] Discovered 8 AMD GPU devices
I1101 08:00:00.300000 driver.go:106] Publishing ResourceSlice: …`;

export const sockets = `$ ls -la /var/lib/kubelet/plugins_registry /var/lib/kubelet/plugins/gpu.amd.com
srwxr-xr-x. 1 root root    0 Nov  1 08:00 gpu.amd.com-reg.sock   # kubelet watches this dir
srwxr-xr-x. 1 root root    0 Nov  1 08:00 dra.sock               # the gRPC service
-rw-------. 1 root root 1200 Nov  3 10:13 checkpoint.json        # driver's prepared claims`;

export const getInfo = `# kubelet → gpu.amd.com-reg.sock: GetInfo()  (PluginInfo fields; values reconstructed)
type: DRAPlugin
name: gpu.amd.com
endpoint: /var/lib/kubelet/plugins/gpu.amd.com/dra.sock
supported_versions: [v1.DRAPlugin, v1beta1.DRAPlugin]   # kubelet 1.35 picks v1`;

export const sliceDevice = `# ResourceSlice 00000-gpu.amd.com-${c.node}-x7q2m (1 of ${c.gpus.length} devices)
- name: ${device.name}
  attributes:
    productName: {string: Instinct_MI355X_OAM}
    partitionProfile: {string: spx_nps1}
    numaNode: {int: ${device.numa}}
    resource.kubernetes.io/pciBusID: {string: "${device.pci}"}
  capacity:
    memory: {value: 294912Mi}
    computeUnits: {value: "256"}`;

export const kubeletState = `# /var/lib/kubelet/dra_manager_state (kind DRACheckpoint), this claim only
ClaimUID:  ${c.claimUid}
ClaimName: ${c.claim}
Namespace: ${c.ns}
PodUIDs:   {${c.podUid}: {}}
DriverState: {}        # filled in after the driver answers (step 6)`;

export const request = `# NodePrepareResourcesRequest → dra.sock
claims:
- namespace: ${c.ns}
  uid: ${c.claimUid}
  name: ${c.claim}`;

export const response = `# NodePrepareResourcesResponse ← dra.sock
claims:
  ${c.claimUid}:            # keyed by claim UID
    devices:
    - request_names: [gpu]
      pool_name: ${c.node}
      device_name: ${c.device}
      cdi_device_ids:
      - k8s.gpu.amd.com/gpu=common
      - ${c.cdiId}
    error: ""`;

export const kubeletStateAfter = `DriverState:
  gpu.amd.com:
    Devices:
    - PoolName: ${c.node}
      DeviceName: ${c.device}
      RequestNames: [gpu]
      CDIDeviceIDs: [k8s.gpu.amd.com/gpu=common, k8s.gpu.amd.com/gpu=${short(c.claimUid)}-${c.device}]`;

/** The four records that must agree on a healthy node. */
export const used = c.usedOn(c.node);
export const fourWay = [
  { where: 'API: claims with pool = node', how: 'kubectl get resourceclaims -A', n: used.length },
  { where: 'kubelet: dra_manager_state', how: 'ClaimInfoStateList', n: 2 },
  { where: 'driver: checkpoint.json', how: 'v1.preparedClaims', n: 2 },
  { where: 'runtime: /var/run/cdi', how: 'per-claim files', n: 2 },
];
if (fourWay.some((r) => r.n !== used.length)) throw new Error('four-way counts disagree with the snapshot');
export const free = c.freeOn(c.node);
export const c307 = c;
