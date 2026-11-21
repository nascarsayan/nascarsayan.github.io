/** One bit of SRAM, the 6-transistor cell (caches and registers are made of these). */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [{ id: 'cell', label: 'One bit: 6 transistors between two bit lines', tone: 'violet', direction: 'right' }],
  nodes: [
    { id: 'wl', label: 'Word line', detail: 'selects one row of cells', shape: 'pill', band: -1, tone: 'warn' },
    { id: 'bl', label: 'Bit line', detail: 'the bit', parent: 'cell' },
    { id: 'axl', label: 'Access transistor', parent: 'cell', tone: 'teal' },
    { id: 'inv1', label: 'Inverter 1', detail: 'Q (2 transistors)', parent: 'cell', tone: 'violet' },
    { id: 'inv2', label: 'Inverter 2', detail: 'not Q (2 transistors)', parent: 'cell', tone: 'violet', info: 'Each inverter drives the other, so the pair holds 0 or 1 for as long as there is power, without refresh. Six transistors per bit makes SRAM fast but big: that is why caches are MB, not GB.' },
    { id: 'axr', label: 'Access transistor', parent: 'cell', tone: 'teal' },
    { id: 'blb', label: 'Bit line bar', detail: 'its opposite', parent: 'cell' },
  ],
  edges: [
    { from: 'wl', to: 'axl', label: 'opens', style: 'dashed', tone: 'warn' },
    { from: 'wl', to: 'axr', label: 'opens', style: 'dashed', tone: 'warn' },
    { from: 'bl', to: 'axl', arrow: 'both' },
    { from: 'axl', to: 'inv1', arrow: 'both' },
    { from: 'inv1', to: 'inv2', arrow: 'both' },
    { from: 'inv2', to: 'axr', arrow: 'both' },
    { from: 'axr', to: 'blb', arrow: 'both' },
  ],
});
