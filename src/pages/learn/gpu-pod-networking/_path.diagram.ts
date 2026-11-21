/** Two roads out of the prefill Pod on the example node gpu-node-1: eth0 through Cilium, and the data NIC under the GPU's PCIe switch. */
import { defineDiagram } from '@/diagrams/spec';
import { podPair } from './_topo';

export default defineDiagram({
  kind: 'graph',
  // Pod and the GPU's PCIe slice side by side, the data path on top; the host's eth0 road is a row below.
  layout: 'columns',
  groups: [
    { id: 'pod', label: 'prefill Pod', tone: 'pink' },
    { id: 'n5', label: `NUMA ${podPair.numa}: one PCIe Gen 5 switch`, tone: 'teal' },
  ],
  nodes: [
    { id: 'net1', label: 'net1', parent: 'pod', detail: `macvlan on ${podPair.nic}` },
    { id: 'verbs', label: '/dev/infiniband/*', parent: 'pod', detail: 'uverbs0-7, rdma_cm' },
    { id: 'proc', label: 'prefill process', parent: 'pod', detail: 'vLLM + KV transfer library' },
    { id: 'eth0', label: 'eth0', parent: 'pod', detail: 'Cilium, Pod IP' },
    { id: 'nic', label: `${podPair.nic} = ${podPair.rdma}`, parent: 'n5', tone: 'teal', detail: 'ConnectX-7, 400 Gb/s NDR' },
    { id: 'sw', label: `PCIe switch ${podPair.switch}`, parent: 'n5', detail: 'upstream port, Gen 5' },
    { id: 'gpu', label: `${podPair.gpu} HBM`, parent: 'n5', tone: 'peach', detail: podPair.gpuPci },
    { id: 'cil', band: 1, label: 'Cilium eBPF', detail: 'host: policy, VXLAN tunnel' },
    { id: 'e25', band: 1, label: 'eno1', detail: 'host 25 GbE, default route' },
    { id: 'fab', label: 'Data fabric (400G leaf)', shape: 'external', detail: 'RoCE v2, MTU 9000' },
    { id: 'cn', band: 1, label: 'Cluster network', shape: 'external', detail: 'services, other Pods' },
    { id: 'kvs', label: 'Remote peer', shape: 'store', detail: 'another GPU node or KV store' },
  ],
  edges: [
    { from: 'proc', to: 'eth0' },
    { from: 'eth0', to: 'cil', label: 'veth' },
    { from: 'cil', to: 'e25' },
    { from: 'e25', to: 'cn' },
    { from: 'proc', to: 'net1' },
    { from: 'net1', to: 'nic', label: 'macvlan child' },
    { from: 'proc', to: 'verbs', label: 'post work' },
    { from: 'verbs', to: 'nic', label: 'doorbell', style: 'dashed' },
    { from: 'gpu', to: 'sw', label: 'x16' },
    { from: 'sw', to: 'nic', label: 'x16' },
    { from: 'nic', to: 'fab' },
    { from: 'fab', to: 'kvs' },
  ],
});
