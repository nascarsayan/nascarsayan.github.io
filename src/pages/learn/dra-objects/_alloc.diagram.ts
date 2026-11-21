/** From Pod creation to an allocated claim. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'sequence',
  participants: [
    { id: 'rs', label: 'ReplicaSet controller' },
    { id: 'api', label: 'API server', tone: 'primary' },
    { id: 'rcc', label: 'resourceclaim controller' },
    { id: 'sched', label: 'Scheduler (DynamicResources)', tone: 'teal' },
    { id: 'kubelet', label: 'kubelet', tone: 'pink' },
  ],
  messages: [
    { from: 'rs', to: 'api', label: 'create Pod (resourceClaimTemplateName)' },
    { from: 'api', to: 'rcc', label: 'watch: Pod needs a claim' },
    { from: 'rcc', to: 'api', label: 'create ResourceClaim, owner = Pod; set Pod resourceClaimStatuses' },
    { from: 'api', to: 'sched', label: 'Pod schedulable (PreEnqueue passes)' },
    { from: 'sched', to: 'sched', label: 'PreFilter + Filter: which nodes have matching free devices' },
    { from: 'sched', to: 'sched', label: 'Reserve: pick gpu-5-132, hold in memory' },
    { from: 'sched', to: 'api', label: 'PreBind: write status.allocation + reservedFor', tone: 'good' },
    { from: 'sched', to: 'api', label: 'Bind Pod to gpu-node-1' },
    { from: 'api', to: 'kubelet', label: 'Pod assigned: NodePrepareResources next' },
  ],
  frames: [
    { label: 'Claim created', from: 'm1', to: 'm3', tone: 'muted' },
    { label: 'Scheduling cycle', from: 'm4', to: 'm6', tone: 'primary' },
    { label: 'Binding cycle', from: 'm7', to: 'm8', tone: 'good' },
  ],
});
