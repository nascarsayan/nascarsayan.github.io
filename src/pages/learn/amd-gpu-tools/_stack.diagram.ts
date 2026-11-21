/** Where each AMD tool gets its answer: everything goes through the amdgpu driver. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'auto',
  direction: 'auto',
  groups: [
    { id: 'user', label: 'Tools you run', tone: 'primary' },
    { id: 'kern', label: 'Kernel', tone: 'violet' },
  ],
  nodes: [
    { id: 'cli', label: 'amd-smi', parent: 'user', detail: 'the CLI you type' },
    { id: 'exp', label: 'metrics exporter', parent: 'user', detail: 'Pod, every scrape', info: 'device-metrics-exporter: the same library, polled by Prometheus every 30 s.' },
    { id: 'rinfo', label: 'rocminfo', parent: 'user', detail: 'ROCm runtime view' },
    { id: 'jctl', label: 'journalctl -k', parent: 'user', detail: 'reads the host log only' },
    { id: 'lib', label: 'AMD SMI library', detail: 'libamd_smi' },
    { id: 'sysfs', label: 'sysfs files', parent: 'kern', detail: '/sys/class/drm/card5/device', shape: 'store' },
    { id: 'kfd', label: '/dev/kfd', parent: 'kern', detail: 'compute interface' },
    { id: 'drv', label: 'amdgpu driver', parent: 'kern', detail: 'the only thing that talks to the chip', tone: 'violet' },
    { id: 'klog', label: 'kernel log', parent: 'kern', detail: 'journald', shape: 'store' },
    { id: 'gpu', label: 'MI355X GPU 4', detail: 'firmware: PSP, SMU', shape: 'external', tone: 'peach' },
  ],
  edges: [
    { from: 'cli', to: 'lib' },
    { from: 'exp', to: 'lib' },
    { from: 'lib', to: 'sysfs' },
    { from: 'rinfo', to: 'kfd' },
    { from: 'sysfs', to: 'drv' },
    { from: 'kfd', to: 'drv' },
    { from: 'drv', to: 'gpu' },
    { from: 'drv', to: 'klog', label: 'writes events' },
    { from: 'jctl', to: 'klog' },
  ],
});
