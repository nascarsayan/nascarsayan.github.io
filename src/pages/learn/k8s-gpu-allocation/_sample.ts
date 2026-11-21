/**
 * A sample cluster shared by the GPUs-in-Kubernetes pages: a small fleet of
 * 8× MI355X nodes running an LLM prefill Deployment with the AMD DRA driver.
 * One Pod is followed end to end. Every name, UID, address, version and time is
 * made up (illustrative example output); only the object shapes follow kubectl,
 * CDI and sysfs. Derived numbers (counts,
 * free GPUs, durations) are computed below, not typed.
 */

export const ns = 'gpu-demo';
export const deploy = 'llm-prefill';
export const rs = 'llm-prefill-5f7d8c9b6';
export const pod = 'llm-prefill-5f7d8c9b6-p4x7k';
export const podUid = 'b0d10001-0000-4000-8000-000000000001';
export const template = 'llm-prefill-gpu';
export const claim = 'llm-prefill-5f7d8c9b6-p4x7k-gpu-z8k3q';
export const claimUid = 'c1a10001-0000-4000-8000-000000000001';
export const node = 'gpu-node-1';
export const device = 'gpu-5-132';
export const cdiId = `k8s.gpu.amd.com/gpu=${claimUid}-${device}`;
export const cdiFile = `/var/run/cdi/k8s.gpu.amd.com-gpu_${claimUid}.yaml`;

/**
 * Timeline in causal order. "API" = apiserver timestamps (1 s resolution).
 * "node" = journal on the node. The node clock reads at least ~1 s behind
 * the API clock (its sandbox log line is earlier than the Pod's creation), so
 * compare times only within one clock.
 */
export const timeline = [
  { clock: 'API', t: '10:00:00', what: `Deployment and ReplicaSet created, replicas: 12` },
  { clock: 'API', t: '10:12:00', what: 'ReplicaSet controller creates the Pod; resourceclaim controller creates its claim' },
  { clock: 'API', t: '10:12:00', what: 'Scheduler allocates gpu-5-132, binds the Pod (PodScheduled=True)' },
  { clock: 'node', t: '10:11:58.900', what: 'containerd RunPodSandbox; Multus adds eth0 and net1' },
  { clock: 'node', t: '10:11:59', what: 'init container write-config runs, exits 0' },
  { clock: 'node', t: '10:12:00', what: 'container prefill started (CDI edits applied)' },
  { clock: 'node', t: '10:12:01.100', what: 'kubelet logs podStartE2EDuration="1.1s"' },
  { clock: 'API', t: '10:16:00', what: 'Ready=True: model loaded, readiness probe passes' },
];
const sec = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 1000;
/** Seconds from container start to Ready (model load). */
export const loadSeconds = sec('2026-11-03T10:12:00Z', '2026-11-03T10:16:00Z');
export const loadText = `${Math.floor(loadSeconds / 60)} min ${loadSeconds % 60} s`;

/** The template every Pod of the Deployment points at (trimmed). */
export const templateYaml = `apiVersion: resource.k8s.io/v1
kind: ResourceClaimTemplate
metadata:
  name: ${template}
  namespace: ${ns}
spec:
  spec:
    devices:
      requests:
      - name: gpu
        exactly:
          deviceClassName: gpu.amd.com
          allocationMode: ExactCount
          count: 1`;

/** Pod spec fields that matter for the GPU (trimmed from kubectl get pod -o yaml). */
export const podYamlDra = `spec:
  resourceClaims:
  - name: gpu
    resourceClaimTemplateName: ${template}
  containers:
  - name: prefill
    resources:
      claims:
      - name: gpu                  # use the Pod-level claim "gpu"
      requests: {cpu: "8", memory: 256Gi, rdma/hca_devices: "1"}
      limits:   {cpu: "8", memory: 256Gi, rdma/hca_devices: "1"}
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - {key: example.com/gpu-node, operator: Exists}`;

/** What the same Pod would look like under the device plugin model (for comparison). */
export const podYamlPlugin = `spec:
  containers:
  - name: prefill
    resources:
      requests: {cpu: "8", memory: 256Gi, amd.com/gpu: 1, rdma/hca_devices: "1"}
      limits:   {cpu: "8", memory: 256Gi, amd.com/gpu: 1, rdma/hca_devices: "1"}
  affinity: …same node affinity…`;

/** The claim right after the resourceclaim controller creates it: no status yet. */
export const claimYamlNew = `apiVersion: resource.k8s.io/v1
kind: ResourceClaim
metadata:
  name: ${claim}
  namespace: ${ns}
  annotations:
    resource.kubernetes.io/pod-claim-name: gpu
  ownerReferences:
  - {kind: Pod, name: ${pod}, controller: true}
  finalizers: [resource.kubernetes.io/delete-protection]
spec:
  devices:
    requests:
    - name: gpu
      exactly: {deviceClassName: gpu.amd.com, allocationMode: ExactCount, count: 1}
status: {}          # not allocated yet`;

/** The claim's status after the scheduler's PreBind (kubectl get resourceclaim -o yaml). */
export const claimStatusYaml = `status:
  allocation:
    devices:
      results:
      - request: gpu
        driver: gpu.amd.com
        pool: ${node}
        device: ${device}
    nodeSelector:
      nodeSelectorTerms:
      - matchFields:
        - {key: metadata.name, operator: In, values: [${node}]}
  reservedFor:
  - resource: pods
    name: ${pod}
    uid: ${podUid}`;

/** The CDI spec file the DRA driver writes during NodePrepareResources (example content). */
export const cdiYaml = `# ${cdiFile}
cdiVersion: 0.5.0
kind: k8s.gpu.amd.com/gpu
devices:
    - name: ${claimUid}-${device}
      containerEdits:
        deviceNodes:
            - path: /dev/kfd
              hostPath: /dev/kfd
              type: c
              major: 238
              permissions: rwm
            - path: /dev/dri/card5
              hostPath: /dev/dri/card5
              type: c
              major: 226
              minor: 5
              permissions: rwm
            - path: /dev/dri/renderD132
              hostPath: /dev/dri/renderD132
              type: c
              major: 226
              minor: 132
              permissions: rwm`;

export const cdiCommonYaml = `# /var/run/cdi/k8s.gpu.amd.com-gpu_common.yaml
cdiVersion: 0.3.0
kind: k8s.gpu.amd.com/gpu
devices:
    - name: common
      containerEdits:
        env:
            - KUBERNETES_NODE_NAME=${node}
            - DRA_RESOURCE_DRIVER_NAME=gpu.amd.com`;

/** The driver's own record of the prepared claim (/var/lib/kubelet/plugins/gpu.amd.com/checkpoint.json, trimmed). */
export const driverCheckpoint = `"preparedClaims": {
  "${claimUid}": [{
    "request_names": ["gpu"],
    "pool_name": "${node}",
    "device_name": "${device}",
    "cdi_device_ids": [
      "k8s.gpu.amd.com/gpu=common",
      "${cdiId}"
    ]
  }]
}`;

/** What the container sees, derived from the two CDI entries above (kfd + card + render, plus 2 env vars). */
export const containerView = `/dev/kfd             c 238,0    # ROCm compute interface (one for all GPUs)
/dev/dri/card5       c 226,5    # DRM card node of GPU 0000:8b:00.0
/dev/dri/renderD132  c 226,132  # render node of the same GPU
KUBERNETES_NODE_NAME=${node}
DRA_RESOURCE_DRIVER_NAME=gpu.amd.com`;

/** Multus network-status annotation on the Pod (example; IPs and MACs masked). */
export const networkStatus = [
  { name: 'cilium', interface: 'eth0', ips: ['<pod-ip>'], mac: '02:00:00:…', default: true, gateway: ['<gw>'] },
  { name: 'default/multus-data-net-5', interface: 'net1', ips: ['<data-net-ip>'], mac: '02:00:01:…' },
];

/**
 * The 8 GPUs and 8 400G NICs of one example node (synthetic profile). GPUs 0-3 sit
 * on NUMA node 0, GPUs 4-7 on NUMA node 1. Each GPU shares a PCIe switch with one
 * NIC: GPU i pairs with NIC i (`gpu` field), not merely with "a NIC on the same NUMA node".
 * `root` is the PCIe root (host bridge) above the GPU's switch: one per GPU.
 */
const gpuBdfs = ['0000:11:00.0', '0000:2f:00.0', '0000:4d:00.0', '0000:6b:00.0', '0000:8b:00.0', '0000:a9:00.0', '0000:c7:00.0', '0000:e5:00.0'];
const nicBdfs = ['0000:12:00.0', '0000:30:00.0', '0000:4e:00.0', '0000:6c:00.0', '0000:8c:00.0', '0000:aa:00.0', '0000:c8:00.0', '0000:e6:00.0'];
export const gpus = gpuBdfs.map((pci, i) => ({
  index: i, name: `gpu-${i + 1}-${128 + i}`, pci, card: `card${i + 1}`, render: `renderD${128 + i}`, numa: i < 4 ? 0 : 1, root: `pci0000:${(i * 0x20).toString(16).padStart(2, '0')}`,
}));
export const nics = nicBdfs.map((pci, i) => ({ gpu: i, netdev: `ens${i + 1}np0`, rdma: `rdma${i}`, pci, numa: i < 4 ? 0 : 1 }));
/** The NIC behind the same PCIe switch as GPU index i. */
export const nicFor = (gpuIndex: number) => nics.find((n) => n.gpu === gpuIndex)!;
/** Device name gpu-<card>-<render>: the two DRM minor numbers. */
export const parseDeviceName = (n: string) => { const [, c, r] = n.split('-'); return { card: `card${c}`, render: `renderD${r}` }; };

/** All GPU claims in the sample cluster (kubectl get resourceclaims -A): pod short name → node, device. */
export const allocations: { pod: string; node: string; device: string }[] = [
  ['small-…-r2m9t', 'gpu-node-1', 'gpu-6-133'], ['small-…-d8w4n', 'gpu-node-2', 'gpu-1-128'],
  ['small-…-h3k7v', 'gpu-node-3', 'gpu-3-130'], ['small-…-t6q2x', 'gpu-node-4', 'gpu-8-135'],
  ['large-…-p4x7k', 'gpu-node-1', 'gpu-5-132'],
  ['large-…-b7n4c', 'gpu-node-2', 'gpu-2-129'], ['large-…-f9s2m', 'gpu-node-2', 'gpu-4-131'],
  ['large-…-k5v8r', 'gpu-node-2', 'gpu-7-134'], ['large-…-m2x6d', 'gpu-node-2', 'gpu-8-135'],
  ['large-…-q8h3w', 'gpu-node-3', 'gpu-1-128'], ['large-…-s4j9p', 'gpu-node-3', 'gpu-5-132'],
  ['large-…-w7c5t', 'gpu-node-3', 'gpu-6-133'], ['large-…-x3g8k', 'gpu-node-4', 'gpu-2-129'],
  ['large-…-z6r2b', 'gpu-node-4', 'gpu-3-130'], ['large-…-c9m4f', 'gpu-node-4', 'gpu-5-132'],
  ['large-…-g2t7n', 'gpu-node-4', 'gpu-7-134'],
].map(([pod, node, device]) => ({ pod, node, device }));

export const gpuNodes = ['gpu-node-1', 'gpu-node-2', 'gpu-node-3', 'gpu-node-4'];
export const deviceNames = gpus.map((g) => g.name).sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
export const totalGpus = gpuNodes.length * deviceNames.length;
export const usedGpus = allocations.length;
export const targetCount = allocations.filter((a) => a.pod.startsWith('large')).length;
export const draftCount = allocations.filter((a) => a.pod.startsWith('small')).length;
/** Node × device grid: 1 = held by a claim, 0 = free (for a <Matrix>). */
export const usageGrid = gpuNodes.map((n) => deviceNames.map((d) => (allocations.some((a) => a.node === n && a.device === d) ? 1 : 0)));
export const usedOn = (n: string) => allocations.filter((a) => a.node === n).map((a) => a.device);
export const freeOn = (n: string) => deviceNames.filter((d) => !usedOn(n).includes(d));
