/** Xid codes most likely to matter, quoted from NVIDIA's Xid catalog, with a suggested response. */
export const XIDS = [
  { xid: '13', desc: 'Graphics Engine Exception', action: 'RESTART_APP', amd: 'a job error, no RAS event', ours: 'Usually a bad kernel or pointer. The workload owner restarts the replica; hold the node only if it repeats across workloads.' },
  { xid: '63', desc: 'GPU memory remapping event', action: 'IGNORE', amd: 'an HBM page retired, under the budget', ours: 'Graceful HBM wear. Keep serving; ticket it and watch ROW_REMAPPER for pending or failed remaps.' },
  { xid: '64', desc: 'GPU memory remapping failure', action: 'RESET_GPU', amd: 'bad-page threshold exceeded', ours: 'Hold, drain, nvidia-bug-report.sh, then reset the GPU; contact NVIDIA support.' },
  { xid: '79', desc: 'GPU has fallen off the bus', action: 'RESTART_BM', amd: 'GPU missing from amd-smi list / lspci', ours: 'Hold, drain, capture (nvidia-bug-report.sh), then restart the bare-metal host; reseat or RMA if it repeats.' },
  { xid: '119', desc: 'GSP RPC Timeout', action: 'RESET_GPU', amd: 'PSP/SMU firmware not answering', ours: 'The GPU\'s own processor stopped answering. Hold, drain, capture, reset the GPU (one GPU on HGX, not the baseboard).' },
];
