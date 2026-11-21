/** Failure classes on one MI355X node: what each does to the 8 GPUs, the signal, and the fix. */
type S = 'ok' | 'hit' | 'down' | 'slow' | 'blind';
const all = (s: S): S[] => Array(8).fill(s);
const one = (i: number, s: S, rest: S = 'ok'): S[] => all(rest).map((x, k) => (k === i ? s : x));
export interface Cls { id: string; label: string; tiles: S[]; radius: string; amd: string; nvidia: string; fix: string }
export const CLASSES: Cls[] = [
  { id: 'ce', label: 'Correctable memory error', tiles: all('ok'), radius: 'none: ECC fixed the data', amd: '`gpu_ecc_correct_*` rises', nvidia: 'SBE counts, Xid 92', fix: 'watch the rate' },
  { id: 'hbm', label: 'Uncorrectable HBM error', tiles: one(3, 'hit'), radius: 'the process that read the bad data on GPU 3', amd: 'UMC UE, a bad row retired (16 pages), CPER', nvidia: 'Xid 48, 94/95, row remap (Xid 63)', fix: 'none until the 128-page budget is spent; then RMA' },
  { id: 'fatal', label: 'Fatal (non-HBM or ATHUB)', tiles: one(3, 'hit', 'down'), radius: 'the whole hive: MODE1 resets all 8 GPUs', amd: 'UE in GFX/SDMA/MMHUB/XGMI, or `RAS Intr triggered` (ATHUB, no counter)', nvidia: 'Xid 95, 140', fix: 'reset (automatic); RMA if it repeats' },
  { id: 'wedge', label: 'Wedge: reset fails', tiles: one(3, 'hit', 'down'), radius: 'the whole node until power is removed', amd: '`PSP resume failed` (-62) after MODE1', nvidia: 'Xid 79, 62, 143', fix: 'cold power cycle (off, confirm Off, on); then firmware or RMA' },
  { id: 'hang', label: 'Hang', tiles: one(5, 'hit'), radius: "the GPU's processes", amd: '`ring … timeout`, job log "GPU hang"', nvidia: 'Xid 109, 119/120', fix: 'engine or GPU reset (on MI35x a GPU reset is a hive reset)' },
  { id: 'bus', label: 'Fell off the bus', tiles: one(6, 'hit'), radius: 'the GPU (often the node on MI35x)', amd: 'GPU missing from `lspci` / `amd-smi list`, fatal AER', nvidia: 'Xid 79', fix: 'host restart; reseat or RMA' },
  { id: 'heat', label: 'Overheat', tiles: one(1, 'slow', 'ok'), radius: 'performance first, then the GPU (shutdown at 110 °C)', amd: 'junction > 100 °C, thermal violation residency', nvidia: 'thermal clock event reasons', fix: 'cooling, facility ticket' },
  { id: 'pcie', label: 'Host link (PCIe) errors', tiles: one(2, 'slow'), radius: 'the GPU: slower host copies, then lost', amd: '`pcie_replay_count`, AER counters, link width < 16', nvidia: '`DCGM_FI_DEV_PCIE_REPLAY_COUNTER`, AER', fix: 'reseat riser or retimer, RMA' },
  { id: 'xgmi', label: 'Peer link (XGMI) errors', tiles: [ 'ok', 'ok', 'ok', 'ok', 'slow', 'hit', 'ok', 'ok' ], radius: 'GPU and its peers; hive reset at risk', amd: 'link `D` in `amd-smi xgmi`, `gpu_ecc_*_xgmi_wafl`', nvidia: 'NVLink errors, Xid 74/145', fix: 'fabric triage, RMA' },
  { id: 'fw', label: 'Firmware or driver mismatch', tiles: Array(8).fill('slow'), radius: 'the node', amd: 'version drift across GPUs or nodes in `amd-smi firmware`', nvidia: 'Fabric Manager version ≠ driver version: every GPU unusable', fix: 'change-managed reflash or upgrade' },
  { id: 'stale', label: 'Stale telemetry', tiles: all('blind'), radius: 'monitoring: every GPU looks healthy, none may be', amd: 'exporter serves frozen values; `changes(gpu_energy_consumed[15m]) == 0`', nvidia: 'DCGM down', fix: 'freshness alert; fix the exporter; check the kernel log' },
];
