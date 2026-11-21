/**
 * The GPU 4 ↔ Pod join on the example node gpu-node-1. Illustrative, made-up
 * output (shared with ../amd-gpu-tools/_sample.ts). GPU 4's BDF, card, render
 * node, OAM slot and PIDs are parsed from that sample, so the pages agree; the
 * splits and cross-checks shown on the page are computed here.
 */
import { processOut, list, metric, staticOut } from '../amd-gpu-tools/_sample';
export { processOut, list as listOut } from '../amd-gpu-tools/_sample';

const field = (s: string, k: string) => s.match(new RegExp(`^\\s*${k}: (.+)$`, 'm'))![1].trim();

/** Host PIDs on GPU 4, in output order: [driver process, engine]. */
export const pids = [...processOut.matchAll(/PID: (\d+)/g)].map((x) => x[1]);
export const enginePid = pids[pids.length - 1];
export const engineVram = [...processOut.matchAll(/VRAM_MEM: (.+)/g)].map((x) => x[1]).at(-1)!;

export const cgroup = '0::/kubepods/burstable/poda1b2c3d4-0000-4000-8000-000000000001/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
export const cgroupOut = `${cgroup}`;
const m = cgroup.match(/^0::\/kubepods\/(\w+)\/pod([0-9a-f-]{36})\/([0-9a-f]{64})$/)!;
export const qos = m[1];
export const podUid = m[2];
export const containerId = m[3];

export const bdf = field(list, 'BDF');
export const card = field(list, 'CARD');
export const render = field(list, 'RENDER');
export const oam = Number(field(list, 'OAM_ID'));
export const numa = Number(staticOut.match(/NUMA:\s*\n\s*NODE: (\d+)/)![1]);
export const serial = field(staticOut, 'PRODUCT_SERIAL');
export const usedVramMB = field(metric, 'USED_VRAM').replace(/ MB$/, '');

export const fdOut = `      1 /dev/dri/${render}
      1 /dev/kfd`;

export const pod = 'llm-prefill-6b7c8d9f5-abcde';
export const ns = 'gpu-demo';
export const crictlOut = `${ns} ${pod} prefill`;
export const claim = `${pod}-gpu-fghij`;
export const podClaimOut = `[{"name":"gpu","resourceClaimName":"${claim}"}]`;
export const reservedUid = 'a1b2c3d4-0000-4000-8000-000000000001';
/** The AMD DRA driver names devices gpu-<card>-<render>. */
export const device = `gpu-${card.replace('card', '')}-${render.replace('renderD', '')}`;
export const claimOut = `[{"device":"${device}","driver":"gpu.amd.com","pool":"gpu-node-1","request":"gpu"}]
[{"name":"${pod}","resource":"pods","uid":"${reservedUid}"}]`;
export const uidMatch = reservedUid === podUid;

const dm = device.match(/^gpu-(\d+)-(\d+)$/)!;
export const deviceCard = `card${dm[1]}`;
export const deviceRender = `renderD${dm[2]}`;
export const renderMatch = fdOut.includes(`/dev/dri/${deviceRender}`);

/** The whole example node (profile values); GPU 4's row uses the parsed values above. */
const BDFS = ['0000:11:00.0', '0000:2f:00.0', '0000:4d:00.0', '0000:6b:00.0', '0000:8b:00.0', '0000:a9:00.0', '0000:c7:00.0', '0000:e5:00.0'];
const OAMS = [2, 3, 0, 1, oam, 7, 4, 5];
export const pod2 = 'llm-prefill-small-7f8e9d6c5-klmno';
const pod2Pid = '42890';
export const gpus = BDFS.map((b, i) => ({
  gpu: i,
  bdf: i === 4 ? bdf : b,
  oam: OAMS[i],
  numa: i < 4 ? 0 : 1,
  dev: i === 4 ? device : `gpu-${i + 1}-${128 + i}`,
  pids: i === 4 ? pids.join(',') : i === 5 ? pod2Pid : '-',
  pod: i === 4 ? `${ns}/${pod}` : i === 5 ? `${ns}/${pod2}` : '-',
}));
export const device2 = gpus[5].dev;

const pad = (s: string | number, n: number) => String(s).padEnd(n);
export const mapOut = [
  `${pad('GPU', 4)}${pad('BDF', 14)}${pad('OAM', 5)}${pad('DRA device', 13)}${pad('PIDs', 18)}Pod`,
  ...gpus.map((g) => `${pad(g.gpu, 4)}${pad(g.bdf, 14)}${pad(g.oam, 5)}${pad(g.dev, 13)}${pad(g.pids, 18)}${g.pod}`),
].join('\n');

export const sliceOut = [...gpus.slice(2, 6).map((g) => `${g.dev} ${g.bdf} numa=${g.numa}`), '...'].join('\n');

export const exporterOut = `gpu_used_vram{gpu_id="4",hostname="gpu-node-1",namespace="${ns}",
  pod="${pod}",container="prefill",...} ${usedVramMB}`;
