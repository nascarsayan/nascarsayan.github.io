/**
 * The CDI worked example, derived at build time from the sample cluster snapshot
 * (claim c1a10001… on gpu-node-1). Every derived string is checked
 * against the example file content, so a wrong rule fails the build.
 */
import * as c from '../k8s-gpu-allocation/_sample';

const DRM_MAJOR = 226; // /dev/dri/* on the node: crw-rw---- root video 226, N
const KFD = { path: '/dev/kfd', major: 238, minor: 0 }; // ls -l /dev/kfd: 238, 0

/** Split a fully qualified CDI name "<vendor>/<class>=<name>". */
export const splitId = (id: string) => {
  const [kind, name] = id.split('=');
  const [vendor, cls] = kind.split('/');
  return { kind, vendor, cls, name };
};

/** The AMD driver's file naming: kind with "/" → "-", then "_<claim uid>.yaml" (as in /var/run/cdi). */
export const specFileFor = (kind: string, claimUid: string) => `/var/run/cdi/${kind.replace('/', '-')}_${claimUid}.yaml`;

/** Device nodes for one whole GPU, from its ResourceSlice device name. */
export const nodesFor = (device: string) => {
  const { card, render } = c.parseDeviceName(device);
  const m = (s: string) => Number(s.replace(/\D/g, ''));
  return [
    { ...KFD, note: 'ROCm compute interface, shared by all GPUs' },
    { path: `/dev/dri/${card}`, major: DRM_MAJOR, minor: m(card), note: 'DRM card node of this GPU' },
    { path: `/dev/dri/${render}`, major: DRM_MAJOR, minor: m(render), note: 'DRM render node of this GPU' },
  ];
};

export const ids = ['k8s.gpu.amd.com/gpu=common', c.cdiId];
export const parsed = ids.map(splitId);
export const file = specFileFor(parsed[1].kind, c.claimUid);
export const nodes = nodesFor(c.device);

// Build-time checks against the example snapshot.
if (file !== c.cdiFile) throw new Error(`CDI file rule wrong: ${file} != ${c.cdiFile}`);
for (const n of nodes.slice(1)) {
  if (!c.cdiYaml.includes(`path: ${n.path}`) || !c.cdiYaml.includes(`minor: ${n.minor}`)) throw new Error(`CDI node ${n.path} not in example spec`);
}

/** The CRI CreateContainer field the kubelet fills (runtime API v1, ContainerConfig.CDI_devices = 17). */
export const criYaml = `# CRI CreateContainerRequest → config (only the GPU part)
config:
  metadata: {name: prefill}
  CDI_devices:
  - name: ${ids[0]}
  - name: ${ids[1]}`;

/** What the CDI library adds to the OCI runtime spec for these two devices. */
export const ociJson = [
  '"process": {"env": [ …, ' + `"KUBERNETES_NODE_NAME=${c.node}", "DRA_RESOURCE_DRIVER_NAME=gpu.amd.com"]},`,
  '"linux": {',
  '  "devices": [',
  ...nodes.map((n, i) => `    {"path": "${n.path}", "type": "c", "major": ${n.major}, "minor": ${n.minor}}${i < nodes.length - 1 ? ',' : ''}`),
  '  ],',
  '  "resources": {"devices": [',
  '    {"allow": false, "access": "rwm"},          // containerd default: deny all',
  ...nodes.map((n, i) => `    {"allow": true, "type": "c", "major": ${n.major}, "minor": ${n.minor}, "access": "rwm"}${i < nodes.length - 1 ? ',' : ''}`),
  '  ]}',
  '}',
].join('\n');

/** Decoder data for every GPU on the node: what a claim for it would inject. */
export const decoder = c.gpus.map((g) => ({
  name: g.name, pci: g.pci, numa: g.numa,
  nodes: nodesFor(g.name).map((n) => `${n.path}  c ${n.major}:${n.minor}`),
  heldBy: c.allocations.find((a) => a.node === c.node && a.device === g.name)?.pod ?? null,
}));
export const nodeName = c.node;
