/** Level 2: one CPU core, front end to back end. */
import { defineDiagram } from '@/diagrams/spec';

export default defineDiagram({
  kind: 'graph',
  layout: 'columns',
  groups: [
    { id: 'front', label: '1 · Front end: what to do', tone: 'primary' },
    { id: 'order', label: '2 · Out of order', tone: 'violet' },
    { id: 'exec', label: '3 · Execute', tone: 'good' },
    { id: 'mem', label: '4 · Memory', tone: 'sky' },
  ],
  nodes: [
    { id: 'bp', label: 'Branch predictor', detail: 'guesses where code goes next', parent: 'front', tone: 'primary', info: 'Guesses the outcome of every `if` before it is known, so fetching never waits. Right about 97% of the time; a wrong guess throws away about 15 cycles of work.' },
    { id: 'l1i', label: 'L1 instruction cache', detail: '32 KB', shape: 'store', parent: 'front', tone: 'primary' },
    { id: 'dec', label: 'Decoders', detail: 'instructions → µops', parent: 'front', tone: 'primary', info: 'Split each machine instruction (x86 or Arm) into one or more simple internal operations (micro-ops), up to 6 per cycle.' },
    { id: 'rob', label: 'Rename + reorder buffer', detail: '~500 µops in flight', parent: 'order', tone: 'violet', info: 'Gives every result a fresh internal register, so unrelated instructions can run in any order. The reorder buffer then retires them in program order, so the program never sees the shuffle.' },
    { id: 'sched', label: 'Scheduler', detail: 'starts µops whose inputs are ready', parent: 'order', tone: 'violet' },
    { id: 'alu', label: 'Integer ALUs', detail: '4 × add, compare, logic', parent: 'exec', tone: 'good', info: 'Arithmetic logic units: add, subtract, AND, OR, compare, shift on 64-bit integers, one result per cycle each.' },
    { id: 'fpu', label: 'Vector / FP units', detail: '512-bit SIMD', parent: 'exec', tone: 'good', info: 'Floating-point and vector math: one instruction works on 16 floats at once (AVX-512, or Arm SVE).' },
    { id: 'regs', label: 'Register files', detail: '~300 integer, ~300 vector', shape: 'store', parent: 'exec', tone: 'good' },
    { id: 'lsu', label: 'Load / store unit', detail: 'addresses, TLB', parent: 'mem', tone: 'sky', info: 'Computes addresses and translates virtual to physical addresses with the TLB (a small cache of page tables).' },
    { id: 'l1d', label: 'L1 data cache', detail: '48 KB, 5 cycles', shape: 'store', parent: 'mem', tone: 'sky' },
    { id: 'l2', label: 'L2 cache', detail: '2 MB, 15 cycles', shape: 'store', parent: 'mem', tone: 'sky' },
  ],
  edges: [
    { from: 'bp', to: 'l1i' },
    { from: 'l1i', to: 'dec' },
    { from: 'dec', to: 'rob' },
    { from: 'rob', to: 'sched' },
    { from: 'sched', to: 'alu' },
    { from: 'regs', to: 'lsu', arrow: 'both' },
    { from: 'lsu', to: 'l1d', arrow: 'both' },
    { from: 'l1d', to: 'l2', arrow: 'both' },
  ],
});
