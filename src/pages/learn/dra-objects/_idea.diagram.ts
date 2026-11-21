/** The idea: each DRA object answers one question. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'tala',
  direction: 'right',
  nodes: [
    { id: 'slice', label: 'ResourceSlice', detail: 'What is on this node?', tone: 'teal', info: 'The shelf inventory of one store: every GPU on one node, with its attributes. Written by the driver.' },
    { id: 'class', label: 'DeviceClass', detail: 'What counts as an AMD GPU?', tone: 'violet', info: 'A category: a CEL filter over devices. Cluster-scoped, named, referred to by claims.' },
    { id: 'tmpl', label: 'ResourceClaimTemplate', detail: 'What will each Pod need?', tone: 'peach', info: 'A blank order form. Each Pod that names it gets its own filled-in copy.' },
    { id: 'claim', label: 'ResourceClaim', detail: 'Which GPU did this Pod get?', tone: 'pink', info: 'The filled-in order. spec = what is needed; status = which device was picked and who uses it.' },
    { id: 'sched', label: 'Scheduler', detail: 'Which free GPU fits?', tone: 'primary', shape: 'pill' },
  ],
  edges: [
    { from: 'tmpl', to: 'claim', label: 'one copy per Pod' },
    { from: 'slice', to: 'sched', label: 'inventory' },
    { from: 'class', to: 'sched', label: 'filter' },
    { from: 'sched', to: 'claim', label: 'writes the device' },
  ],
});
