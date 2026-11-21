/**
 * Worked numbers for one wavefront's load, computed at build time.
 * MI355X facts used: wave64, 128-byte cache lines (rocminfo field "Cacheline Size", public spec),
 * LDS with 64 banks of 4 bytes (CDNA4 ISA guide), ~8 TB/s HBM (AMD spec, approximate).
 */
export const LANES = 64;
export const LINE = 128;
export const BANKS = 64;
export const HBM_BPS = 8e12;

/** Lanes drawn as 4 rows of 16. */
export const laneRows = ['lanes 0–15', 'lanes 16–31', 'lanes 32–47', 'lanes 48–63'];
export const laneCols = Array.from({ length: 16 }, (_, j) => String(j));
const grid = (f: (lane: number) => number) => laneRows.map((_, r) => laneCols.map((_, c) => f(r * 16 + c)));

/** Byte address each lane reads (relative to the array base). */
const coalescedAddr = (lane: number) => lane * 16; // global_load_dwordx4: lane i reads bytes 16i..16i+15
const stridedAddr = (lane: number) => lane * 32 * 4; // lane i reads x[i*32] (a column of a 32-wide float matrix)

export const coalescedLine = grid((l) => Math.floor(coalescedAddr(l) / LINE));
export const stridedLine = grid((l) => Math.floor(stridedAddr(l) / LINE));

const lines = (g: number[][]) => new Set(g.flat()).size;
export const coalesced = { bytesUsed: LANES * 16, lines: lines(coalescedLine) };
export const strided = { bytesUsed: LANES * 4, lines: lines(stridedLine) };
export const coalescedFetched = coalesced.lines * LINE; // 1,024 B
export const stridedFetched = strided.lines * LINE; // 8,192 B
export const stridedEff = Math.round((strided.bytesUsed / stridedFetched) * 1000) / 10; // %

/** LDS: 64 lanes read column 0 of a 64 × W float tile (lane = row). Bank = (byte address / 4) mod 64. */
const bank = (row: number, width: number) => ((row * width * 4) / 4) % BANKS;
export const bankNoPad = grid((l) => bank(l, 64));
export const bankPad = grid((l) => bank(l, 65));
const worstWay = (g: number[][]) => Math.max(...[...g.flat().reduce((m, b) => m.set(b, (m.get(b) ?? 0) + 1), new Map<number, number>()).values()]);
export const wayNoPad = worstWay(bankNoPad); // 64
export const wayPad = worstWay(bankPad); // 1

/** Little's law, same assumption as the execution-model page (500 ns, not measured). */
export const LAT_S = 500e-9;
export const inFlight = HBM_BPS * LAT_S; // bytes
export const perCU = inFlight / 256;
export const wavesPerCU = Math.round(perCU / coalescedFetched);
/** Time to move one wave's 1 KB at the whole GPU's bandwidth, in picoseconds. */
export const oneKbPs = Math.round((coalescedFetched / HBM_BPS) * 1e12);

export const fmt = (n: number) => n.toLocaleString('en-US');
