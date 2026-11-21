/** Level 3 (from the CPU): how a cache finds a line. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'addr', label: '1 · Split the address', tone: 'muted' },
    { id: 'look', label: '2 · Look in one set', tone: 'sky' },
    { id: 'res', label: '3 · Result', tone: 'good' },
  ],
  nodes: [
    { id: 'tag', label: 'Tag', detail: 'high bits: which line', parent: 'addr' },
    { id: 'idx', label: 'Index', detail: 'middle bits: which set', parent: 'addr' },
    { id: 'off', label: 'Offset', detail: 'low 6 bits: byte in line', parent: 'addr' },
    { id: 'set', label: 'One set', detail: '16 ways = 16 lines', parent: 'look', tone: 'sky', info: 'A 32 MB cache of 64-byte lines has 512K lines. They are grouped in sets of 16 (16-way): an address may live in only one set, in any of its 16 ways.' },
    { id: 'line', label: 'Cache line', detail: 'tag + state + 64 bytes', shape: 'store', parent: 'look', tone: 'sky', info: 'State is MESI: Modified, Exclusive, Shared or Invalid, for keeping the cores\' copies coherent.' },
    { id: 'cmp', label: '16 tag compares', detail: 'all at once', parent: 'look', tone: 'good' },
    { id: 'hit', label: 'Hit: data out', detail: 'about 40 cycles for L3', parent: 'res', tone: 'good' },
    { id: 'miss', label: 'Miss: ask RAM', detail: 'evict the oldest way', parent: 'res', tone: 'risk' },
  ],
  edges: [
    { from: 'idx', to: 'set', label: 'selects' },
    { from: 'tag', to: 'cmp' },
    { from: 'line', to: 'cmp', label: 'tags' },
    { from: 'cmp', to: 'hit' },
    { from: 'cmp', to: 'miss', style: 'dashed' },
  ],
});
