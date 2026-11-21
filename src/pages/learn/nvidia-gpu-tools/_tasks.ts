/**
 * AMD ↔ NVIDIA, task by task. AMD output is illustrative (example MI355X node, GPU 4,
 * see ../amd-gpu-tools/_sample.ts). NVIDIA commands are from NVIDIA's
 * documentation and were NOT run for this page: no output is shown for them.
 */
import { list, monitor, badPages, xgmi, processOut, metric } from '../amd-gpu-tools/_sample';
const lines = (s: string, n: number[]) => s.split('\n').filter((_, i) => n.includes(i)).join('\n');
export interface Task { id: string; label: string; amd: { cmd: string; out: string; read: string }; nv: { cmd: string; read: string } }
export const TASKS: Task[] = [
  { id: 'inventory', label: 'Which GPU is which', amd: { cmd: 'amd-smi list -e -g 4', out: lines(list, [0, 1, 6, 7, 11]), read: 'Index, PCI BDF, render node, DRM card, OAM slot.' },
    nv: { cmd: 'nvidia-smi -L\nnvidia-smi --query-gpu=index,uuid,pci.bus_id --format=csv\ndcgmi discovery -l', read: 'Index, UUID and PCI bus ID per GPU; DCGM also lists NVSwitches.' } },
  { id: 'now', label: 'How is it doing now', amd: { cmd: 'amd-smi monitor -p -t -u -m -e', out: lines(monitor, [0, 3]), read: 'Power against the cap, temperatures, clock, ECC and PCIe replays: one line per GPU.' },
    nv: { cmd: 'nvidia-smi\nnvidia-smi --query-gpu=index,temperature.gpu,power.draw,memory.used,utilization.gpu --format=csv', read: 'The summary table, or chosen fields for scripts. Check field names with nvidia-smi --help-query-gpu first: they change between drivers.' } },
  { id: 'errors', label: 'Memory errors', amd: { cmd: 'amd-smi metric -g 4 -e', out: lines(metric, [0, 13, 14, 15, 16]), read: 'Correctable, uncorrectable and deferred totals; -k gives them per block.' },
    nv: { cmd: 'nvidia-smi -q -d ECC', read: 'Volatile (since driver load) and aggregate (lifetime) single- and double-bit counts.' } },
  { id: 'wear', label: 'Memory wear', amd: { cmd: 'amd-smi bad-pages -g 4', out: badPages, read: 'Retired HBM pages; 128 is the budget.' },
    nv: { cmd: 'nvidia-smi -q -d ROW_REMAPPER', read: 'Remapped HBM rows: correctable, uncorrectable, pending, and whether a remap failed (Xid 64).' } },
  { id: 'links', label: 'Links between GPUs', amd: { cmd: 'amd-smi xgmi -l', out: lines(xgmi, [0, 1, 4, 7]), read: 'Seven U per row: every XGMI peer link is up.' },
    nv: { cmd: 'nvidia-smi nvlink -s\nnvidia-smi nvlink -e\nnvidia-smi topo -m', read: 'NVLink status and error counters; topo -m is the GPU/NIC connection matrix with CPU and NUMA affinity.' } },
  { id: 'procs', label: 'Who uses it', amd: { cmd: 'amd-smi process -g 4', out: lines(processOut, [0, 1, 3, 4, 5, 7, 8]), read: 'Host PIDs and their GPU memory.' },
    nv: { cmd: 'nvidia-smi --query-compute-apps=pid,gpu_uuid,used_memory --format=csv', read: 'Host PIDs per GPU UUID, with memory used.' } },
  { id: 'throttle', label: 'Why is it slow', amd: { cmd: 'amd-smi metric -g 4 -v', out: lines(metric, [0, 22, 23, 24, 25]), read: 'Which limit holds the clock down: power cap (PPT), socket or HBM heat.' },
    nv: { cmd: 'nvidia-smi -q -d PERFORMANCE', read: 'Clock event reasons (formerly "throttle reasons"): power cap, thermal, sync boost, and so on.' } },
  { id: 'stress', label: 'Stress test (drained node)', amd: { cmd: 'agfhc …, rvs …, TransferBench …   # disruptive', out: '(disruptive: described only)', read: 'AGFHC single_pass (minutes) or burn-in (hours); RVS modules; TransferBench for link bandwidth.' },
    nv: { cmd: 'dcgmi diag -r 3', read: 'Under 35 min on 8 Hopper GPUs: stress, NVBandwidth, NCCL tests, targeted power. Level 2 and above are disruptive.' } },
  { id: 'reset', label: 'Reset scope', amd: { cmd: 'amd-smi reset -G -g 4   # never on a serving node', out: '(not run: resets all 8 GPUs of the hive)', read: 'On MI35x a GPU reset is a hive reset, and it kills every /dev/kfd user.' },
    nv: { cmd: 'nvidia-smi -r -i 4', read: 'One GPU on HGX (needs root and no process on it). On NVL72 a reset re-registers the GPU with the fabric.' } },
];
