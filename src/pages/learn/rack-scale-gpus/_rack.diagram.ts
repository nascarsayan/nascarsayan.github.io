/** NVL72 and Helios rack anatomy: compute trays, switch trays, fabric software. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'nv', label: 'NVIDIA GB300 NVL72', tone: 'lime' },
    { id: 'amd', label: 'AMD Helios', tone: 'peach' },
  ],
  nodes: [
    { id: 'nvc', label: '18 compute trays', parent: 'nv', detail: '2 Grace + 4 Blackwell Ultra each; IMEX on each' },
    { id: 'nvs', label: '9 NVLink switch trays', parent: 'nv', detail: 'NVSwitch chips, NVOS', tone: 'teal' },
    { id: 'nvf', label: 'Fabric Manager + NVLSM', parent: 'nv', detail: 'routing, partitions, errors', shape: 'note' },
    { id: 'amc', label: '18 compute trays', parent: 'amd', detail: '1 EPYC Venice + 4 MI455X each' },
    { id: 'ams', label: 'Switch trays', parent: 'amd', detail: 'Tomahawk 6 Ethernet chips; UALink over Ethernet', tone: 'teal' },
    { id: 'amf', label: 'AMD fabric + rack management', parent: 'amd', detail: 'scale-up health, power, firmware', shape: 'note' },
  ],
  edges: [
    { from: 'nvc', to: 'nvs', label: 'NVLink 5, 1.8 TB/s per GPU' },
    { from: 'nvf', to: 'nvs', label: 'configures', style: 'dashed' },
    { from: 'amc', to: 'ams', label: 'UALoE, single switch hop' },
    { from: 'amf', to: 'ams', label: 'health', style: 'dashed' },
  ],
});
