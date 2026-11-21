/** A prefill Pod's two networks and its RDMA devices. */
import { defineDiagram } from '@/diagrams/spec';
import { podPair } from './_topo';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  groups: [
    { id: 'pod', label: 'prefill Pod', tone: 'pink' },
    { id: 'host', label: 'GPU node gpu-node-1 (example)', tone: 'muted' },
  ],
  nodes: [
    { id: 'eth0', label: 'eth0', parent: 'pod', detail: 'Pod network (Cilium)' },
    { id: 'net1', label: 'net1', parent: 'pod', detail: 'macvlan, data network IP' },
    { id: 'verbs', label: '/dev/infiniband/*', parent: 'pod', detail: 'uverbs0-7, umad0-7, rdma_cm' },
    { id: 'cil', label: 'Cilium', parent: 'host', detail: 'primary CNI' },
    { id: 'nic', label: `${podPair.nic} = ${podPair.rdma}`, parent: 'host', detail: `ConnectX-7 400G, NUMA ${podPair.numa}`, tone: 'teal' },
    { id: 'rdp', label: 'rdma-device-plugin', parent: 'host', detail: 'rdma/hca_devices: 1k' },
    { id: 'wh', label: 'whereabouts', parent: 'host', detail: 'IPAM, IPPool CRs' },
  ],
  edges: [
    { from: 'cil', to: 'eth0', label: 'CNI ADD via Multus' },
    { from: 'nic', to: 'net1', label: 'macvlan child' },
    { from: 'wh', to: 'net1', label: 'assigns IP', style: 'dashed' },
    { from: 'rdp', to: 'verbs', label: 'Allocate' },
  ],
});
