/** Where one RAS event travels: from the HBM cell to a (future) node taint. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  groups: [
    { id: 'chip', label: 'GPU package and board', tone: 'peach' },
    { id: 'host', label: 'Host kernel', tone: 'violet' },
    { id: 'k8s', label: 'Monitoring and Kubernetes', tone: 'primary' },
  ],
  nodes: [
    { id: 'hbm', label: 'HBM cell', parent: 'chip', detail: 'bits flip', shape: 'store' },
    { id: 'umc', label: 'UMC', parent: 'chip', detail: 'memory controller: ECC check', info: 'Unified Memory Controller. Owns HBM ECC: fixes single flips, detects worse.' },
    { id: 'aca', label: 'ACA bank', parent: 'chip', detail: 'status, address, which block', info: 'Error registers held by the SMU. The only record of which block failed.' },
    { id: 'fed', label: 'Fatal status bit', parent: 'chip', detail: 'ATHUB path, MI300/MI350', tone: 'risk' },
    { id: 'eeprom', label: 'Bad-page EEPROM', parent: 'chip', detail: 'survives reboots', shape: 'store' },
    { id: 'hive', label: 'All 8 GPUs', parent: 'chip', detail: 'one XGMI hive' },
    { id: 'drv', label: 'amdgpu driver', parent: 'host', detail: 'harvests banks, decides', tone: 'violet' },
    { id: 'klog', label: 'Kernel log', parent: 'host', detail: 'journalctl -k', shape: 'store' },
    { id: 'cnt', label: 'Counters', parent: 'host', detail: 'sysfs ras/aca_umc', info: 'Also amd-smi metric -k. Per block: ue, ce, de.' },
    { id: 'cper', label: 'CPER record', parent: 'host', detail: 'amd-smi ras --cper → AFID' },
    { id: 'exp', label: 'Exporter', parent: 'k8s', detail: 'gpu_ecc_*, gpu_health' },
    { id: 'npd', label: 'NPD condition', parent: 'k8s', detail: 'node-problem-detector rule', tone: 'muted' },
    { id: 'taint', label: 'Node taint', parent: 'k8s', detail: 'optional, from the condition', tone: 'muted' },
  ],
  edges: [
    { from: 'hbm', to: 'umc' },
    { from: 'umc', to: 'aca' },
    { from: 'aca', to: 'drv', label: 'harvest' },
    { from: 'fed', to: 'drv', label: 'polled' },
    { from: 'drv', to: 'eeprom', label: 'retire page' },
    { from: 'drv', to: 'hive', label: 'MODE1 reset' },
    { from: 'drv', to: 'klog' },
    { from: 'drv', to: 'cnt' },
    { from: 'drv', to: 'cper' },
    { from: 'cnt', to: 'exp' },
    { from: 'exp', to: 'npd', label: 'metric rule' },
    { from: 'klog', to: 'npd', label: 'kernel rule' },
    { from: 'npd', to: 'taint' },
  ],
});
