/** Kubelet and DRA driver: registration, Pod start and stop. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'drv', label: 'DRA driver (kubelet plugin)', tone: 'teal' },
    { id: 'kubelet', label: 'kubelet' },
    { id: 'api', label: 'API server', tone: 'primary' },
    { id: 'ctrd', label: 'containerd' },
  ],
  messages: [
    { from: 'drv', to: 'drv', label: 'discover 8 GPUs in sysfs; open dra.sock' },
    { from: 'drv', to: 'kubelet', label: 'create plugins_registry/gpu.amd.com-reg.sock' },
    { from: 'kubelet', to: 'drv', label: 'GetInfo → name gpu.amd.com, endpoint, services' },
    { from: 'drv', to: 'api', label: 'publish ResourceSlice (8 devices)' },
    { from: 'api', to: 'kubelet', label: 'Pod bound here, claim allocated' },
    { from: 'kubelet', to: 'kubelet', label: 'checkpoint claim in dra_manager_state' },
    { from: 'kubelet', to: 'drv', label: 'NodePrepareResources(claim uid, name, ns)' },
    { from: 'drv', to: 'api', label: 'get ResourceClaim (read allocation)' },
    { from: 'drv', to: 'drv', label: 'write CDI spec + checkpoint.json' },
    { from: 'drv', to: 'kubelet', label: 'devices + CDI IDs' },
    { from: 'kubelet', to: 'ctrd', label: 'CreateContainer with CDI IDs', tone: 'good' },
    { from: 'kubelet', to: 'drv', label: 'last Pod gone: NodeUnprepareResources' },
    { from: 'drv', to: 'drv', label: 'delete CDI spec, update checkpoint.json' },
  ],
  frames: [
    { label: 'Register (driver start)', from: 'm1', to: 'm4', tone: 'teal' },
    { label: 'Prepare (Pod start)', from: 'm5', to: 'm11', tone: 'primary' },
    { label: 'Unprepare (Pod end)', from: 'm12', to: 'm13', tone: 'muted' },
  ],
});
