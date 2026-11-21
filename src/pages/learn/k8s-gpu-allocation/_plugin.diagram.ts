/** Device plugin API: register, advertise a count, allocate on the node. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'plugin', label: 'Device plugin', detail: 'DaemonSet Pod', tone: 'teal' },
    { id: 'kubelet', label: 'kubelet', tone: 'sky' },
    { id: 'api', label: 'API server', tone: 'note' },
    { id: 'sched', label: 'Scheduler', tone: 'primary' },
  ],
  messages: [
    { from: 'plugin', to: 'kubelet', label: 'Register(amd.com/gpu) on kubelet.sock' },
    { from: 'kubelet', to: 'plugin', label: 'ListAndWatch' },
    { from: 'plugin', to: 'kubelet', label: '8 device IDs, each Healthy', style: 'dashed' },
    { from: 'kubelet', to: 'api', label: 'Node allocatable amd.com/gpu: 8' },
    { from: 'sched', to: 'api', label: 'free ≥ 1? bind Pod to node' },
    { from: 'kubelet', to: 'plugin', label: 'Allocate([ID 3])' },
    { from: 'plugin', to: 'kubelet', label: 'device nodes, env, mounts or CDI names', style: 'dashed' },
    { from: 'kubelet', to: 'kubelet', label: 'write kubelet_internal_checkpoint' },
  ],
});
