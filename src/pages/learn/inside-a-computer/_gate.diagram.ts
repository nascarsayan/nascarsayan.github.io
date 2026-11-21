/** A CMOS AND gate = NAND (4 transistors) + inverter (2 transistors), power rail on top, ground below. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'layers',
  allowAspect: 'drawn the way the circuit is built: power rail on top, ground rail at the bottom',
  groups: [
    { id: 'top', label: 'Power rail', tone: 'warn' },
    { id: 'nand', label: 'NAND: 4 transistors', tone: 'violet', direction: 'right' },
    { id: 'inv', label: 'Inverter: 2 transistors', tone: 'teal', direction: 'right' },
    { id: 'bot', label: 'Ground rail', tone: 'muted' },
  ],
  nodes: [
    { id: 'vdd', label: 'VDD ≈ 0.8 V', detail: 'logic 1', shape: 'pill', parent: 'top', tone: 'warn' },
    { id: 'p', label: '2 pMOS in parallel', detail: 'on when an input is 0', parent: 'nand', tone: 'violet', info: 'Either one pulls the middle node up to 1. So the NAND output is 1 unless both inputs are 1.' },
    { id: 'n', label: '2 nMOS in series', detail: 'on only when both are 1', parent: 'nand', tone: 'violet', info: 'Both must conduct to pull the middle node down to 0.' },
    { id: 'ni', label: 'nMOS', detail: 'pulls the output down', parent: 'inv', tone: 'teal' },
    { id: 'pi', label: 'pMOS', detail: 'pulls the output up', parent: 'inv', tone: 'teal' },
    { id: 'gnd', label: 'Ground 0 V', detail: 'logic 0', shape: 'pill', parent: 'bot' },
  ],
  edges: [
    { from: 'vdd', to: 'p' },
    { from: 'p', to: 'n', label: 'NAND out' },
    { from: 'n', to: 'pi', label: 'drives gates' },
    { from: 'pi', to: 'ni', label: 'AND out' },
    { from: 'ni', to: 'gnd' },
  ],
});
