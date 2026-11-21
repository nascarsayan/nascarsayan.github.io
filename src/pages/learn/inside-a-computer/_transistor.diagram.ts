/** Level 7: one transistor (a FinFET / gate-all-around nMOS). */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  groups: [{ id: 'dev', label: 'One nMOS transistor, about 50 nm wide', tone: 'violet', direction: 'right' }],
  nodes: [
    { id: 'src', label: 'Source', detail: 'n-doped silicon', parent: 'dev', tone: 'violet' },
    { id: 'chan', label: 'Channel', detail: 'p-doped silicon fins', parent: 'dev', tone: 'peach', info: 'No current flows here until the gate voltage pulls enough electrons into it. In gate-all-around chips the channel is a stack of thin sheets the gate wraps on every side.' },
    { id: 'drain', label: 'Drain', detail: 'n-doped silicon', parent: 'dev', tone: 'violet' },
    { id: 'gate', label: 'Gate', detail: 'metal over thin oxide', band: -1, tone: 'warn', info: 'Insulated from the channel by a layer of oxide a few atoms thick. A voltage on the gate turns the switch on; no current flows into the gate itself (apart from leakage).' },
    { id: 'note', label: 'A CPU has ~10 billion of these', detail: 'switching up to 5 billion times a second', shape: 'note', band: 1, tone: 'muted' },
  ],
  edges: [
    { from: 'gate', to: 'chan', label: 'electric field', style: 'dashed', tone: 'warn' },
    { from: 'src', to: 'chan', label: 'electrons' },
    { from: 'chan', to: 'drain', label: 'when on' },
  ],
});
