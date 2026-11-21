/** From a physical GPU to a running prefill container. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'op', label: 'GPU operator', tone: 'primary' },
    { id: 'drv', label: 'DRA driver', tone: 'teal' },
    { id: 'api', label: 'API + scheduler' },
    { id: 'kubelet', label: 'kubelet + containerd' },
    { id: 'pod', label: 'prefill Pod', tone: 'pink' },
  ],
  messages: [
    { from: 'op', to: 'drv', label: 'DeviceConfig → DaemonSet on gpu-vendor=AMD nodes' },
    { from: 'drv', to: 'kubelet', label: 'register gpu.amd.com' },
    { from: 'drv', to: 'api', label: 'ResourceSlice: 8 GPUs + attributes' },
    { from: 'api', to: 'api', label: 'claim from template; scheduler allocates gpu-5-132' },
    { from: 'kubelet', to: 'drv', label: 'NodePrepareResources → CDI IDs' },
    { from: 'kubelet', to: 'kubelet', label: 'Multus: eth0 + net1; RDMA plugin: /dev/infiniband/*' },
    { from: 'kubelet', to: 'pod', label: 'container with /dev/kfd, card5, renderD132', tone: 'good' },
  ],
  frames: [
    { label: 'Install', from: 'm1', to: 'm3', tone: 'primary' },
    { label: 'Allocate', from: 'm4', to: 'm4', tone: 'muted' },
    { label: 'Start', from: 'm5', to: 'm7', tone: 'good' },
  ],
});
