/** The metrics pipeline on the example cluster: GPU counter → exporter → Prometheus shards → Thanos → you. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  groups: [{ id: 'node', label: 'GPU node gpu-node-1', tone: 'peach' }],
  nodes: [
    { id: 'gpu', label: 'GPU 4 firmware', parent: 'node', detail: 'energy counter', shape: 'store', tone: 'peach' },
    { id: 'drv', label: 'amdgpu driver', parent: 'node', detail: 'sysfs, AMD SMI library' },
    { id: 'exp', label: 'metrics exporter', parent: 'node', detail: 'Pod, port 5000', tone: 'teal', info: 'DaemonSet kube-amd-gpu/default-metrics-exporter, device-metrics-exporter v1.5.0 (example version).' },
    { id: 'prom', label: 'Prometheus', detail: '2 shards × 2 replicas', tone: 'primary', info: 'kube-prometheus-stack. ServiceMonitor default-metrics-exporter, every 30 s.' },
    { id: 'thanos', label: 'thanos-query', detail: 'merges shards and replicas', tone: 'primary' },
    { id: 'you', label: 'Grafana or you', detail: 'PromQL', shape: 'pill', tone: 'pink' },
  ],
  edges: [
    { from: 'exp', to: 'drv', label: 'read' },
    { from: 'drv', to: 'gpu' },
    { from: 'prom', to: 'exp', label: 'scrape every 30 s' },
    { from: 'thanos', to: 'prom', label: 'fan out' },
    { from: 'you', to: 'thanos', label: 'query' },
  ],
});
